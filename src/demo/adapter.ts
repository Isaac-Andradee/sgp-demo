/**
 * Adapter axios que substitui o backend no modo demonstração.
 *
 * Instalado em `api.defaults.adapter` (ver `src/api/client.ts`), intercepta
 * todas as chamadas antes de virarem requisição de rede. Nenhum módulo de API,
 * componente ou hook precisou ser alterado — a camada de API do projeto já era
 * um ponto único de passagem.
 */
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { EquipmentResponseDTO, EquipmentStatus, EquipmentType } from '../types';
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_TYPE_LABELS } from '../types';
import * as db from './store';
import { DemoError } from './store';
import { buildPdf } from './pdf';

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
  /** Continua respondendo mesmo com o modo de manutenção ativo. */
  publicInMaintenance?: boolean;
}

const routes: Route[] = [];

function on(method: string, pattern: RegExp, handler: Handler, publicInMaintenance = false) {
  routes.push({ method: method.toUpperCase(), pattern, handler, publicInMaintenance });
}

/** Latência artificial: sem ela os spinners nunca aparecem e a demo parece falsa. */
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Rotas ────────────────────────────────────────────────────────────────────
// A ordem importa: a primeira que casar vence. Rotas literais vêm antes das
// que têm parâmetro (ex.: /users/security-status antes de /users/:id).

// Sistema e setup
on('GET', /^\/system\/status$/, () => {
  const m = db.getMaintenance();
  return {
    maintenance: m.active,
    maintenanceMessage: m.message ?? '',
    maintenanceWindowStart: m.windowStart,
    maintenanceExpectedReturn: m.expectedReturn,
    announcement: m.announcementEnabled && m.announcementMessage
      ? { message: m.announcementMessage, scheduledAt: m.announcementScheduledAt }
      : null,
  };
}, true);

on('GET', /^\/setup$/, () => ({ needsSetup: false }), true);
on('POST', /^\/setup$/, () => { throw new DemoError(409, 'O sistema já está configurado.'); }, true);

// Autenticação — sempre liberada, para o visitante nunca ficar preso na demo.
on('POST', /^\/auth\/login$/, ({ body }) => {
  const user = db.login(String(body.username ?? ''));
  return {
    token: 'demo-token', type: 'Bearer', expiresIn: 86_400_000,
    username: user.username, fullName: user.fullName, role: user.role,
    mustChangePassword: false,
  };
}, true);

on('POST', /^\/auth\/logout$/, () => { db.logout(); return { message: 'Sessão encerrada.' }; }, true);

on('GET', /^\/auth\/me$/, () => {
  const user = db.currentUser();
  if (!user) throw new DemoError(401, 'Não autenticado.');
  return user;
}, true);

on('PUT', /^\/auth\/me$/, ({ body }) => db.updateOwnProfile(String(body.fullName ?? '')), true);

on('GET', /^\/auth\/suggested-usernames$/, ({ params }) =>
  ({ suggestions: db.suggestUsernames(params.get('fullName') ?? '') }), true);

on('POST', /^\/auth\/(forgot-password|reset-password|recover-with-code)$/, () => {
  throw new DemoError(400, 'Recuperação de senha não está disponível no modo demonstração.');
}, true);

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

// Auditoria
on('GET', /^\/audit$/, ({ params }) => db.listAudit(
  Number(params.get('page') ?? 0),
  Number(params.get('size') ?? 20),
  params.get('actorUsername') ?? undefined,
  params.get('actionType') ?? undefined,
));

// Central de manutenção (DEV) — liberada mesmo em manutenção, como no backend
on('GET', /^\/dev\/maintenance\/status$/, () => ({ active: db.getMaintenance().active }), true);
on('POST', /^\/dev\/maintenance\/enable$/, () => { db.setMaintenance(true); return { message: 'Modo de manutenção ativado.' }; }, true);
on('POST', /^\/dev\/maintenance\/disable$/, () => { db.setMaintenance(false); return { message: 'Modo de manutenção desativado.' }; }, true);

on('GET', /^\/dev\/settings$/, () => {
  const m = db.getMaintenance();
  return {
    maintenanceMessage: m.message,
    maintenanceWindowStart: m.windowStart,
    maintenanceExpectedReturn: m.expectedReturn,
    announcementEnabled: m.announcementEnabled,
    announcementMessage: m.announcementMessage,
    announcementScheduledAt: m.announcementScheduledAt,
  };
}, true);

on('PUT', /^\/dev\/maintenance-settings$/, ({ body }) => {
  db.updateMaintenanceSettings(body as never);
  return { message: 'Configurações atualizadas.' };
}, true);

on('PUT', /^\/dev\/announcement$/, ({ body }) => {
  db.updateAnnouncement(body as never);
  return { message: 'Aviso atualizado.' };
}, true);

on('GET', /^\/dev\/system\/info$/, () => ({
  javaVersion: '— (modo demonstração, sem backend)',
  javaVendor: 'n/d',
  springVersion: 'n/d',
  osName: 'Navegador',
  maintenanceActive: db.getMaintenance().active,
  environment: 'demo',
}), true);

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
  db.recordReportGenerated('inventário');
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
  db.recordReportGenerated('ficha do equipamento');
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
  db.recordReportGenerated('resumo executivo');
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
  const response = {
    data: { message, status, error: 'Demo', timestamp: new Date().toISOString(), path: config.url ?? '' },
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
  if (config.params && typeof config.params === 'object') {
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
      headers: { 'content-type': data instanceof Blob ? 'application/pdf' : 'application/json' },
      config,
    } as AxiosResponse;
    if (validate(status)) return Promise.resolve(response);
    return Promise.reject(axiosError(config, status, (data as { message?: string })?.message ?? 'Erro'));
  };

  if (!route) {
    return settle(404, { message: `Rota não implementada no modo demonstração: ${method} ${path}` });
  }

  // Modo de manutenção: 503 para tudo, exceto rotas liberadas e usuários DEV
  // (mesmo comportamento do MaintenanceFilter do backend).
  if (db.getMaintenance().active && !route.publicInMaintenance) {
    const user = db.currentUser();
    if (user?.role !== 'DEV') {
      return settle(503, { message: 'Sistema em manutenção.' });
    }
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
