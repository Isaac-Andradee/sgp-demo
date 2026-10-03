/**
 * Adapter axios que substitui o backend no modo demonstração.
 *
 * Instalado em `api.defaults.adapter` (ver `src/api/client.ts`), intercepta
 * todas as chamadas antes de virarem requisição de rede. Nenhum módulo de API,
 * componente ou hook precisou ser alterado — a camada de API do projeto já era
 * um ponto único de passagem.
 */
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { AuditLog, EquipmentResponseDTO, EquipmentStatus, EquipmentType } from '../types';
import { AUDIT_ACTION_LABELS, EQUIPMENT_STATUS_LABELS, EQUIPMENT_TYPE_LABELS } from '../types';
import * as db from './store';
import { DemoError } from './store';
import { buildPdf } from './pdf';
import type { PdfLine } from './pdf';

// ─── Infra do roteador ────────────────────────────────────────────────────────

interface Ctx {
  body: Record<string, unknown>;
  params: URLSearchParams;
  m: RegExpMatchArray;
}

type Handler = (ctx: Ctx) => unknown;

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

const routes: Route[] = [];

function on(method: string, pattern: RegExp, handler: Handler) {
  routes.push({ method: method.toUpperCase(), pattern, handler });
}

/** Latência artificial: sem ela os spinners nunca aparecem e a demo parece falsa. */
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Rotas ────────────────────────────────────────────────────────────────────
// A ordem importa: a primeira que casar vence. Rotas literais vêm antes das
// que têm parâmetro (ex.: /users/security-status antes de /users/:id).

// Sistema e setup
// Status público. A Central de Manutenção pertence ao perfil DEV, fora desta
// demonstração, então não há como ativar a manutenção: a resposta é constante.
on('GET', /^\/system\/status$/, () => ({
  maintenance: false,
  maintenanceMessage: '',
  maintenanceWindowStart: null,
  maintenanceExpectedReturn: null,
  announcement: null,
}));

on('GET', /^\/setup$/, () => ({ needsSetup: false }));
on('POST', /^\/setup$/, () => { throw new DemoError(409, 'O sistema já está configurado.'); });

// Autenticação — sempre liberada, para o visitante nunca ficar preso na demo.
on('POST', /^\/auth\/login$/, ({ body }) => {
  const user = db.login(String(body.username ?? ''));
  return {
    token: 'demo-token', type: 'Bearer', expiresIn: 86_400_000,
    username: user.username, fullName: user.fullName, role: user.role,
    mustChangePassword: false,
  };
});

on('POST', /^\/auth\/logout$/, () => { db.logout(); return { message: 'Sessão encerrada.' }; });

on('GET', /^\/auth\/me$/, () => {
  const user = db.currentUser();
  if (!user) throw new DemoError(401, 'Não autenticado.');
  return user;
});

on('PUT', /^\/auth\/me$/, ({ body }) => db.updateOwnProfile(String(body.fullName ?? '')));

on('GET', /^\/auth\/suggested-usernames$/, ({ params }) =>
  ({ suggestions: db.suggestUsernames(params.get('fullName') ?? '') }));

on('POST', /^\/auth\/(forgot-password|reset-password|recover-with-code)$/, () => {
  throw new DemoError(400, 'Recuperação de senha não está disponível no modo demonstração.');
});

// Equipamentos — rotas literais primeiro
on('GET', /^\/equipments\/types$/, () => Object.keys(EQUIPMENT_TYPE_LABELS).filter((t) => t !== 'MOUSE'));
on('GET', /^\/equipments\/statuses$/, () => Object.keys(EQUIPMENT_STATUS_LABELS));
on('GET', /^\/equipments\/brands$/, () => db.brands());
on('GET', /^\/equipments\/stats\/kpi$/, () => db.dashboardStats());
on('GET', /^\/equipments\/stats\/sectors$/, () => db.sectorStats());

on('GET', /^\/equipments$/, ({ params }) => {
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);
  const all = db.listEquipments();
  const start = page * size;
  const content = all.slice(start, start + size);
  const totalPages = Math.max(1, Math.ceil(all.length / size));
  return {
    content, page, size,
    totalElements: all.length,
    totalPages,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
});

on('POST', /^\/equipments\/filter$/, ({ body }) => {
  const f = body as {
    textoBusca?: string; marca?: string; setorId?: string;
    tipo?: EquipmentType; status?: EquipmentStatus;
  };
  const term = f.textoBusca?.trim().toLowerCase();
  return db.listEquipments().filter((e) => {
    if (f.marca && e.brand !== f.marca) return false;
    if (f.setorId && e.currentSector.id !== f.setorId) return false;
    if (f.tipo && e.type !== f.tipo) return false;
    if (f.status && e.status !== f.status) return false;
    if (!term) return true;
    return [e.assetNumber, e.serialNumber, e.description, e.hostname, e.ipAddress, e.brand, e.equipmentUser, e.currentSector.acronym]
      .some((v) => v?.toLowerCase().includes(term));
  });
});

on('POST', /^\/equipments\/move$/, ({ body }) => {
  db.moveEquipment(body as never);
  return { message: 'Equipamento movimentado com sucesso.' };
});

on('POST', /^\/equipments\/swap$/, ({ body }) => {
  db.swapEquipment(body as never);
  return { message: 'Troca realizada com sucesso.' };
});

// Defeitos
on('GET', /^\/equipments\/([^/]+)\/defects$/, ({ m, params }) =>
  db.listDefects(m[1], {
    status: params.get('status') ?? undefined,
    year: params.get('year') ? Number(params.get('year')) : undefined,
    month: params.get('month') ? Number(params.get('month')) : undefined,
  }));

on('POST', /^\/equipments\/([^/]+)\/defects$/, ({ m, body }) =>
  db.createDefect(m[1], String(body.description ?? '')));

on('PUT', /^\/equipments\/([^/]+)\/defects\/([^/]+)$/, ({ m, body }) =>
  db.updateDefect(m[2], String(body.description ?? '')));

on('PATCH', /^\/equipments\/([^/]+)\/defects\/([^/]+)\/resolve$/, ({ m }) => db.resolveDefect(m[2]));

// Equipamentos — CRUD por id (depois das literais)
on('POST', /^\/equipments$/, ({ body }) => db.createEquipment(body as never));
on('PUT', /^\/equipments\/([^/]+)$/, ({ m, body }) => db.updateEquipment(m[1], body as never));
on('DELETE', /^\/equipments\/([^/]+)$/, ({ m }) => { db.deleteEquipment(m[1]); return { message: 'Equipamento excluído.' }; });

// Setores
on('GET', /^\/sectors$/, () => db.listSectors());
on('POST', /^\/sectors$/, ({ body }) => db.createSector(body as never));
on('PUT', /^\/sectors\/([^/]+)$/, ({ m, body }) => db.updateSector(m[1], body as never));
on('DELETE', /^\/sectors\/([^/]+)$/, ({ m }) => { db.deleteSector(m[1]); return { message: 'Setor excluído.' }; });
on('GET', /^\/sectors\/([^/]+)$/, ({ m }) => db.listSectors().find((s) => s.id === m[1]));

// Usuários — literais antes das paramétricas
on('GET', /^\/users\/security-status$/, () => db.securityStatus());

on('GET', /^\/users$/, ({ params }) => {
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 10);
  const all = db.listUsers();
  const start = page * size;
  const content = all.slice(start, start + size);
  const totalPages = Math.max(1, Math.ceil(all.length / size));
  return {
    content, page, size,
    totalElements: all.length, totalPages,
    first: page === 0, last: page >= totalPages - 1, empty: content.length === 0,
  };
});

on('POST', /^\/users$/, ({ body }) => db.createUser(body as never));
on('POST', /^\/users\/([^/]+)\/change-password$/, () => ({ message: 'Senha alterada com sucesso.' }));
on('POST', /^\/users\/([^/]+)\/reset-password$/, ({ m }) => db.adminResetPassword(m[1]));
on('POST', /^\/users\/([^/]+)\/recovery-code$/, ({ m }) => db.generateRecoveryCode(m[1]));
on('GET', /^\/users\/([^/]+)$/, ({ m }) => db.listUsers().find((u) => u.id === m[1]));
on('PUT', /^\/users\/([^/]+)$/, ({ m, body }) => db.updateUser(m[1], body as never));
on('DELETE', /^\/users\/([^/]+)$/, ({ m }) => { db.deleteUser(m[1]); return { message: 'Usuário excluído.' }; });

// Auditoria — busca no servidor (filtros + ordenação + paginação) e exportação
function auditCriteria(params: URLSearchParams): db.AuditCriteria {
  const get = (k: string) => params.get(k) ?? undefined;
  return {
    from: get('from'), to: get('to'), actor: get('actor'),
    actionTypes: params.getAll('actionTypes'),
    entityType: get('entityType'), ip: get('ip'), q: get('q'),
    sort: get('sort'), direction: get('direction'),
  };
}

on('GET', /^\/audit\/filter-options$/, () => db.auditFilterOptions());

on('GET', /^\/audit$/, ({ params }) => db.listAudit(
  auditCriteria(params),
  Number(params.get('page') ?? 0),
  Number(params.get('size') ?? 20),
));

/** Rótulos de entidade dos relatórios (AuditReportService.ENTITY_LABELS). */
const ENTITY_LABELS: Record<string, string> = {
  Equipment: 'Equipamento', EquipmentSheet: 'Ficha de equipamento', User: 'Usuário',
  Report: 'Relatório', System: 'Sistema', Sector: 'Setor',
};
const entityLabel = (t?: string) => (t ? ENTITY_LABELS[t] ?? t : '');
/** dd/MM/aaaa HH:mm:ss, como o DATE_TIME_SECONDS do backend. */
const auditDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR').replace(', ', ' ');

/** Resumo legível dos filtros — cabeçalho do PDF e descrição do registro de auditoria. */
function describeAuditCriteria(c: db.AuditCriteria): string {
  const br = (d: string) => d.split('-').reverse().join('/');
  const parts: string[] = [];
  if (c.from && c.to) parts.push(`Período: ${br(c.from)} a ${br(c.to)}`);
  else if (c.from) parts.push(`Período: desde ${br(c.from)}`);
  else if (c.to) parts.push(`Período: até ${br(c.to)}`);
  if (c.actor?.trim()) parts.push(`Usuário contém: ${c.actor.trim()}`);
  if (c.actionTypes?.length) {
    parts.push(`Eventos: ${c.actionTypes.map((t) => AUDIT_ACTION_LABELS[t as AuditLog['actionType']] ?? t).join(', ')}`);
  }
  if (c.entityType) parts.push(`Entidade: ${entityLabel(c.entityType)}`);
  if (c.ip?.trim()) parts.push(`IP começa com: ${c.ip.trim()}`);
  if (c.q?.trim()) parts.push(`Texto: "${c.q.trim()}"`);
  return parts.length ? parts.join('  |  ') : 'Sem filtros — todos os eventos';
}

/** Campo CSV com aspas quando preciso e fórmulas neutralizadas (CSV injection), como no backend. */
function csvField(raw?: string): string {
  let v = raw ?? '';
  if (v && '=+-@\t\r'.includes(v[0])) v = `'${v}`;
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

on('GET', /^\/audit\/report\/csv$/, ({ params }) => {
  const criteria = auditCriteria(params);
  const logs = db.auditForReport(criteria, 'csv');
  const rows = [
    ['Data/Hora', 'Usuário', 'Evento', 'Código do evento', 'Entidade', 'ID da entidade', 'Descrição', 'IP'],
    ...logs.map((l) => [
      auditDateTime(l.createdAt), l.actorUsername, AUDIT_ACTION_LABELS[l.actionType] ?? l.actionType,
      l.actionType, entityLabel(l.entityType), l.entityId, l.description, l.ipAddress,
    ]),
  ];
  db.recordReportGenerated('Report', 'audit-csv',
    `Relatório de auditoria em CSV gerado (${logs.length} eventos) — ${describeAuditCriteria(criteria)}`);
  // Separador ';' e BOM UTF-8: abre direto no Excel em pt-BR.
  const csv = rows.map((r) => r.map(csvField).join(';')).join('\r\n') + '\r\n';
  return new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
});

on('GET', /^\/audit\/report\/pdf$/, ({ params }) => {
  const criteria = auditCriteria(params);
  const logs = db.auditForReport(criteria, 'pdf');
  const user = db.currentUser();
  const byType = new Map<string, number>();
  logs.forEach((l) => byType.set(l.actionType, (byType.get(l.actionType) ?? 0) + 1));
  const shown = 34;
  const lines: PdfLine[] = [
    { text: describeAuditCriteria(criteria), size: 8 },
    { text: `Gerado em ${new Date().toLocaleString('pt-BR')}${user ? ` por ${user.username}` : ''}`, size: 8, gap: 18 },
    { text: 'Data/Hora            Usuario          Evento', bold: true, size: 9, gap: 13 },
    ...logs.slice(0, shown).map((l) => ({
      text: `${auditDateTime(l.createdAt).padEnd(20)} ${l.actorUsername.padEnd(16)} ${AUDIT_ACTION_LABELS[l.actionType] ?? l.actionType}`,
      size: 8, gap: 11,
    })),
    { text: logs.length > shown ? `... e mais ${logs.length - shown} eventos (a demo gera uma página; o sistema real pagina o PDF).` : '', size: 8, gap: 16 },
    { text: `Total: ${logs.length} evento(s)`, bold: true, size: 10, gap: 16 },
    ...[...byType.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({
      text: `${String(n).padStart(4)}  ${AUDIT_ACTION_LABELS[t as AuditLog['actionType']] ?? t}`, size: 8, gap: 11,
    })),
  ];
  db.recordReportGenerated('Report', 'audit-pdf',
    `Relatório de auditoria em PDF gerado (${logs.length} eventos) — ${describeAuditCriteria(criteria)}`);
  return buildPdf('SGPT Demo — Relatorio de Auditoria (DADOS FICTICIOS)', lines);
});

// Relatórios em PDF
on('GET', /^\/reports\/inventory$/, ({ params }) => {
  const items = db.listEquipments().filter((e) => {
    if (params.get('setorId') && e.currentSector.id !== params.get('setorId')) return false;
    if (params.get('tipo') && e.type !== params.get('tipo')) return false;
    if (params.get('status') && e.status !== params.get('status')) return false;
    if (params.get('marca') && e.brand !== params.get('marca')) return false;
    const q = params.get('textoBusca')?.toLowerCase();
    if (q && ![e.assetNumber, e.description, e.equipmentUser].some((v) => v?.toLowerCase().includes(q))) return false;
    return true;
  });
  db.recordReportGenerated('Report', 'inventory', `Relatório de inventário gerado em PDF (${items.length} itens).`);
  return buildPdf('Relatorio de Inventario — DADOS FICTICIOS', [
    { text: `Gerado em ${new Date().toLocaleString('pt-BR')}`, size: 9 },
    { text: `Total de itens: ${items.length}`, size: 9, gap: 20 },
    { text: 'Patrimonio    Tipo          Marca        Setor   Status', bold: true, gap: 14 },
    ...items.slice(0, 45).map((e) => ({
      text: `${e.assetNumber.padEnd(13)} ${EQUIPMENT_TYPE_LABELS[e.type].padEnd(13)} ${e.brand.padEnd(12)} ${e.currentSector.acronym.padEnd(7)} ${EQUIPMENT_STATUS_LABELS[e.status]}`,
      size: 8,
    })),
    { text: items.length > 45 ? `... e mais ${items.length - 45} itens.` : '', size: 8 },
  ]);
});

on('GET', /^\/reports\/equipment\/([^/]+)$/, ({ m }) => {
  const e = db.listEquipments().find((x) => x.id === m[1]);
  if (!e) throw new DemoError(404, 'Equipamento não encontrado.');
  db.recordReportGenerated('EquipmentSheet', e.id, `Ficha do equipamento ${e.assetNumber} gerada em PDF.`);
  const field = (k: string, v?: string) => ({ text: `${k}: ${v ?? '—'}`, size: 10 });
  return buildPdf('Ficha do Equipamento — DADOS FICTICIOS', [
    { text: `Gerado em ${new Date().toLocaleString('pt-BR')}`, size: 9, gap: 22 },
    field('Patrimonio', e.assetNumber),
    field('Numero de serie', e.serialNumber),
    field('Descricao', e.description),
    field('Tipo', EQUIPMENT_TYPE_LABELS[e.type]),
    field('Marca', e.brand),
    field('Status', EQUIPMENT_STATUS_LABELS[e.status]),
    field('Setor', `${e.currentSector.acronym} — ${e.currentSector.fullName}`),
    field('Responsavel', e.equipmentUser),
    field('Hostname', e.hostname),
    field('Endereco IP', e.ipAddress),
    field('Cadastrado em', new Date(e.createdAt).toLocaleDateString('pt-BR')),
  ]);
});

on('GET', /^\/reports\/summary$/, () => {
  const stats = db.dashboardStats();
  const sectors = db.sectorStats();
  db.recordReportGenerated('Report', 'summary', 'Resumo executivo gerado em PDF.');
  return buildPdf('Resumo Executivo — DADOS FICTICIOS', [
    { text: `Gerado em ${new Date().toLocaleString('pt-BR')}`, size: 9, gap: 22 },
    { text: 'Totais por situacao', bold: true, size: 12, gap: 18 },
    { text: `Em uso: ${stats.kpiEquipamentos.totalEmUso}`, size: 10 },
    { text: `Disponivel: ${stats.kpiEquipamentos.totalDisponivel}`, size: 10 },
    { text: `Em manutencao: ${stats.kpiEquipamentos.totalManutencao}`, size: 10 },
    { text: `Provisorio: ${stats.kpiEquipamentos.totalProvisorio}`, size: 10 },
    { text: `Inservivel: ${stats.kpiEquipamentos.totalInservivel}`, size: 10 },
    { text: `Total geral: ${stats.kpiEquipamentos.totalGeral}`, size: 10, gap: 24 },
    { text: 'Distribuicao por setor', bold: true, size: 12, gap: 18 },
    ...sectors.map((s) => ({ text: `${s.acronym.padEnd(8)} ${String(s.totalItens).padStart(4)} itens   ${s.fullName}`, size: 10 })),
  ]);
});

// ─── Adapter ──────────────────────────────────────────────────────────────────

/** Erro no formato que os interceptors do axios esperam (error.response.status). */
function axiosError(config: InternalAxiosRequestConfig, status: number, message: string) {
  const payload = { message, status, error: 'Demo', timestamp: new Date().toISOString(), path: config.url ?? '' };
  const response = {
    // Download (responseType blob) recebe o erro como Blob, igual ao navegador com o backend real.
    data: config.responseType === 'blob'
      ? new Blob([JSON.stringify(payload)], { type: 'application/json' })
      : payload,
    status,
    statusText: String(status),
    headers: {},
    config,
  } as AxiosResponse;
  return Object.assign(new Error(message), { isAxiosError: true, config, response, toJSON: () => ({ message }) });
}

export const demoAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toUpperCase();

  // Caminho relativo à baseURL + merge dos parâmetros (query na URL e em config.params).
  const raw = config.url ?? '';
  const [rawPath, rawQuery] = raw.split('?');
  const path = rawPath.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(rawQuery ?? '');
  if (config.params instanceof URLSearchParams) {
    // Parâmetros repetidos (ex.: actionTypes=A&actionTypes=B) precisam de append.
    config.params.forEach((v, k) => params.append(k, v));
  } else if (config.params && typeof config.params === 'object') {
    for (const [k, v] of Object.entries(config.params as Record<string, unknown>)) {
      if (v !== undefined && v !== null && String(v) !== '') params.set(k, String(v));
    }
  }

  let body: Record<string, unknown> = {};
  if (typeof config.data === 'string') {
    try { body = JSON.parse(config.data); } catch { body = {}; }
  } else if (config.data && typeof config.data === 'object') {
    body = config.data as Record<string, unknown>;
  }

  await delay(120 + Math.random() * 220);

  const route = routes.find((r) => r.method === method && r.pattern.test(path));

  const settle = (status: number, data: unknown): Promise<AxiosResponse> => {
    const validate = config.validateStatus ?? ((s: number) => s >= 200 && s < 300);
    const response = {
      data, status, statusText: String(status),
      headers: { 'content-type': data instanceof Blob ? data.type : 'application/json' },
      config,
    } as AxiosResponse;
    if (validate(status)) return Promise.resolve(response);
    return Promise.reject(axiosError(config, status, (data as { message?: string })?.message ?? 'Erro'));
  };

  if (!route) {
    return settle(404, { message: `Rota não implementada no modo demonstração: ${method} ${path}` });
  }

  try {
    const data = route.handler({ body, params, m: path.match(route.pattern)! });
    const status = method === 'POST' && !(data instanceof Blob) ? 201 : 200;
    return settle(status, data ?? { message: 'OK' });
  } catch (err) {
    if (err instanceof DemoError) return settle(err.status, { message: err.message });
    return settle(500, { message: (err as Error).message ?? 'Erro inesperado na demonstração.' });
  }
};

/** Marca de uso interno: permite ao restante do app saber que está em modo demo. */
export const IS_DEMO = true;

export type { EquipmentResponseDTO };
