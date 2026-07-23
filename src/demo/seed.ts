/**
 * Seed de dados FICTÍCIOS para o modo demonstração.
 *
 * Nada aqui corresponde a dados reais: setores, pessoas, patrimônios, números de
 * série e endereços IP são inventados. O objetivo é exercitar as regras de
 * negócio do sistema com um volume realista.
 */
import type {
  AuditLog,
  AuditActionType,
  DefectResponse,
  EquipmentResponseDTO,
  EquipmentStatus,
  EquipmentType,
  SectorResponseDTO,
  UserResponse,
} from '../types';

/** Sigla do setor que funciona como almoxarifado de TI (estoque). */
export const STORAGE_SECTOR = 'TIC';

export const DEMO_PASSWORD = 'demo1234';

// ─── Gerador determinístico ───────────────────────────────────────────────────
// PRNG com semente fixa: o seed é sempre idêntico entre recarregamentos e entre
// visitantes, o que torna a demo previsível para gravar vídeo ou tirar print.

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

const rand = createRandom(20260723);

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

/** UUID determinístico (não-criptográfico) — suficiente para dados de demo. */
function uid(prefix: string, n: number): string {
  const hex = (n * 2654435761 % 0xffffffff).toString(16).padStart(8, '0');
  return `${prefix}${hex}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function isoDaysAgo(days: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, int(0, 59), int(0, 59), 0);
  return d.toISOString();
}

// ─── Setores ──────────────────────────────────────────────────────────────────

export const SEED_SECTORS: SectorResponseDTO[] = [
  { id: uid('a', 1), acronym: STORAGE_SECTOR, fullName: 'Núcleo de Tecnologia da Informação' },
  { id: uid('a', 2), acronym: 'GAB', fullName: 'Gabinete' },
  { id: uid('a', 3), acronym: 'ADM', fullName: 'Departamento Administrativo' },
  { id: uid('a', 4), acronym: 'FIN', fullName: 'Departamento Financeiro' },
  { id: uid('a', 5), acronym: 'RH', fullName: 'Recursos Humanos' },
  { id: uid('a', 6), acronym: 'PROT', fullName: 'Protocolo e Arquivo' },
  { id: uid('a', 7), acronym: 'ENG', fullName: 'Divisão de Engenharia' },
  { id: uid('a', 8), acronym: 'ATEND', fullName: 'Central de Atendimento' },
];

// ─── Pessoas fictícias ────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique',
  'Isabela', 'João', 'Larissa', 'Marcos', 'Natália', 'Otávio', 'Paula', 'Rafael',
  'Sofia', 'Thiago', 'Vanessa', 'William',
] as const;

const LAST_NAMES = [
  'Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Ferreira', 'Gomes',
  'Henriques', 'Ibrahim', 'Jardim', 'Klein', 'Lima', 'Moreira', 'Nunes',
  'Oliveira', 'Pacheco', 'Queiroz', 'Ribeiro', 'Souza', 'Teixeira',
] as const;

function personName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

// ─── Usuários do sistema ──────────────────────────────────────────────────────

export const SEED_USERS: UserResponse[] = [
  {
    id: uid('b', 1),
    username: 'admin.demo',
    email: 'admin.demo@exemplo.gov.br',
    fullName: 'Administrador Demonstração',
    role: 'ADMIN',
    enabled: true,
    lastLoginAt: isoDaysAgo(0, 8),
    previousLoginAt: isoDaysAgo(1, 14),
    mustChangePassword: false,
    hasRecoveryCode: true,
  },
  {
    id: uid('b', 2),
    username: 'usuario.demo',
    email: 'usuario.demo@exemplo.gov.br',
    fullName: 'Usuário Operador',
    role: 'USER',
    enabled: true,
    lastLoginAt: isoDaysAgo(0, 10),
    previousLoginAt: isoDaysAgo(2, 11),
    mustChangePassword: false,
  },
  {
    id: uid('b', 3),
    username: 'visualizador.demo',
    email: 'visualizador.demo@exemplo.gov.br',
    fullName: 'Usuário Consulta',
    role: 'VIEWER',
    enabled: true,
    lastLoginAt: isoDaysAgo(3, 15),
    previousLoginAt: isoDaysAgo(6, 9),
    mustChangePassword: false,
  },
  {
    id: uid('b', 4),
    username: 'dev.demo',
    email: 'dev.demo@exemplo.gov.br',
    fullName: 'Técnico Responsável',
    role: 'DEV',
    enabled: true,
    lastLoginAt: isoDaysAgo(0, 7),
    previousLoginAt: isoDaysAgo(1, 18),
    mustChangePassword: false,
    hasRecoveryCode: true,
  },
  {
    id: uid('b', 5),
    username: 'carla.duarte',
    email: 'carla.duarte@exemplo.gov.br',
    fullName: 'Carla Duarte',
    role: 'USER',
    enabled: true,
    lastLoginAt: isoDaysAgo(4, 13),
    mustChangePassword: false,
  },
  {
    id: uid('b', 6),
    username: 'marcos.lima',
    email: 'marcos.lima@exemplo.gov.br',
    fullName: 'Marcos Lima',
    role: 'VIEWER',
    enabled: false,
    lastLoginAt: isoDaysAgo(45, 16),
    mustChangePassword: false,
  },
];

/** Contas de acesso rápido exibidas na tela de login da demo. */
export const DEMO_ACCOUNTS = [
  { username: 'admin.demo', role: 'ADMIN' as const, label: 'Administrador', hint: 'Gerencia usuários, setores, relatórios e auditoria' },
  { username: 'usuario.demo', role: 'USER' as const, label: 'Operador', hint: 'Cadastra, movimenta e troca equipamentos' },
  { username: 'visualizador.demo', role: 'VIEWER' as const, label: 'Consulta', hint: 'Somente leitura — botões de escrita ficam ocultos' },
  { username: 'dev.demo', role: 'DEV' as const, label: 'Técnico', hint: 'Tudo, mais a Central de Manutenção' },
];

// ─── Equipamentos ─────────────────────────────────────────────────────────────

const BRANDS = ['Dell', 'HP', 'Lenovo', 'Positivo', 'Samsung', 'LG', 'Acer', 'Intelbras', 'APC', 'Epson'] as const;

const TYPE_POOL: readonly EquipmentType[] = [
  'PC', 'PC', 'PC', 'PC', 'MONITOR', 'MONITOR', 'MONITOR',
  'NOTEBOOK', 'NOTEBOOK', 'IMPRESSORA', 'SWITCH', 'ROTEADOR',
  'NOBREAK', 'ESTABILIZADOR', 'SERVIDOR', 'ARMAZENAMENTO', 'ROTULADORA', 'OUTROS',
];

const MODEL_BY_TYPE: Partial<Record<EquipmentType, readonly string[]>> = {
  PC: ['OptiPlex 3080', 'ThinkCentre M70', 'EliteDesk 800', 'Master D340'],
  MONITOR: ['Monitor 21,5" LED', 'Monitor 24" IPS', 'Monitor 19" LED'],
  NOTEBOOK: ['Latitude 3420', 'ThinkPad E14', 'ProBook 445'],
  IMPRESSORA: ['LaserJet M428', 'EcoTank L3250', 'Multifuncional M2070'],
  SWITCH: ['Switch 24 portas Gigabit', 'Switch 48 portas PoE'],
  ROTEADOR: ['Roteador corporativo', 'Access Point dual band'],
  NOBREAK: ['Nobreak 1200VA', 'Nobreak 3000VA senoidal'],
  ESTABILIZADOR: ['Estabilizador 1000VA', 'Estabilizador 500VA'],
  SERVIDOR: ['PowerEdge T140', 'ProLiant ML30'],
  ARMAZENAMENTO: ['NAS 4 baias', 'HD externo 2TB'],
  ROTULADORA: ['Rotuladora térmica'],
  OUTROS: ['Equipamento diverso'],
};

function makeSerial(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return `${pick(letters.split(''))}${pick(letters.split(''))}${int(100000, 999999)}`;
}

function makeEquipment(n: number): EquipmentResponseDTO {
  const type = pick(TYPE_POOL);
  const sector = pick(SEED_SECTORS);
  const isStorage = sector.acronym === STORAGE_SECTOR;

  // Distribuição de status coerente com a regra de negócio do sistema:
  // no almoxarifado o item está DISPONIVEL; em setor operacional está EM_USO.
  let status: EquipmentStatus;
  const roll = rand();
  if (isStorage) {
    status = roll < 0.72 ? 'DISPONIVEL' : roll < 0.9 ? 'MANUTENCAO' : roll < 0.96 ? 'INSERVIVEL' : 'BAIXADO';
  } else {
    status = roll < 0.88 ? 'EM_USO' : roll < 0.95 ? 'PROVISORIO' : 'MANUTENCAO';
  }

  const provisional = status === 'PROVISORIO';
  const usesUser = status === 'EM_USO' || status === 'PROVISORIO';
  const isNetworked = type === 'PC' || type === 'NOTEBOOK' || type === 'SERVIDOR';

  return {
    id: uid('c', n),
    // Equipamento provisório entra sem número de patrimônio (regra do sistema).
    assetNumber: provisional ? `PROV-${int(10000, 99999)}` : String(100000 + n * 7 + int(0, 6)),
    serialNumber: makeSerial(),
    description: pick(MODEL_BY_TYPE[type] ?? ['Equipamento']),
    hostname: isNetworked ? `${sector.acronym.toLowerCase()}-${type === 'NOTEBOOK' ? 'nb' : 'pc'}-${String(n).padStart(3, '0')}` : undefined,
    ipAddress: isNetworked ? `10.20.${int(1, 8)}.${int(10, 250)}` : undefined,
    brand: pick(BRANDS),
    type,
    status,
    equipmentUser: usesUser ? personName() : undefined,
    currentSector: sector,
    createdAt: isoDaysAgo(int(5, 900)),
    hasOpenDefect: false,
  };
}

export function buildSeed() {
  const equipments: EquipmentResponseDTO[] = [];
  for (let i = 1; i <= 68; i++) equipments.push(makeEquipment(i));

  // Defeitos: alguns abertos (equipamento fica em MANUTENCAO) e alguns já resolvidos.
  const defects: DefectResponse[] = [];
  const inMaintenance = equipments.filter((e) => e.status === 'MANUTENCAO');
  const DEFECT_TEXTS = [
    'Não liga após queda de energia.',
    'Fonte com ruído e desligamento intermitente.',
    'Tela apresenta linhas verticais.',
    'Teclado não responde em algumas teclas.',
    'Superaquecimento e desligamento automático.',
    'Porta de rede sem link.',
    'Bateria não segura carga.',
    'Ruído alto no cooler.',
  ] as const;

  inMaintenance.forEach((eq, i) => {
    defects.push({
      id: uid('d', i + 1),
      equipmentId: eq.id,
      description: pick(DEFECT_TEXTS),
      reportedAt: isoDaysAgo(int(1, 40), 11),
      reportedBy: pick(['usuario.demo', 'admin.demo', 'carla.duarte']),
      resolvedAt: null,
      status: 'ABERTO',
    });
    eq.hasOpenDefect = true;
  });

  // Histórico de defeitos já resolvidos, para a tela de histórico não nascer vazia.
  const resolvedPool = equipments.filter((e) => e.status === 'EM_USO' || e.status === 'DISPONIVEL').slice(0, 14);
  resolvedPool.forEach((eq, i) => {
    const reported = int(60, 300);
    defects.push({
      id: uid('e', i + 1),
      equipmentId: eq.id,
      description: pick(DEFECT_TEXTS),
      reportedAt: isoDaysAgo(reported, 10),
      reportedBy: pick(['usuario.demo', 'carla.duarte']),
      resolvedAt: isoDaysAgo(reported - int(2, 20), 16),
      status: 'RESOLVIDO',
    });
  });

  // Trilha de auditoria inicial.
  const audit: AuditLog[] = [];
  const ACTIONS: readonly AuditActionType[] = [
    'EQUIPMENT_CREATE', 'EQUIPMENT_UPDATE', 'EQUIPMENT_TRANSFER', 'EQUIPMENT_SWAP',
    'LOGIN', 'LOGOUT', 'REPORT_GENERATED', 'USER_CREATE', 'USER_UPDATE',
  ];
  for (let i = 1; i <= 60; i++) {
    const action = pick(ACTIONS);
    const eq = pick(equipments);
    const actor = pick(['admin.demo', 'usuario.demo', 'dev.demo', 'carla.duarte']);
    audit.push({
      id: uid('f', i),
      actorUsername: actor,
      actionType: action,
      entityType: action.startsWith('USER') ? 'User' : action.startsWith('EQUIPMENT') ? 'Equipment' : 'System',
      entityId: action.startsWith('EQUIPMENT') ? eq.id : '',
      description: describeAction(action, eq.assetNumber, eq.currentSector.acronym),
      ipAddress: `10.20.${int(1, 8)}.${int(10, 250)}`,
      createdAt: isoDaysAgo(int(0, 60), int(8, 18)),
    });
  }
  audit.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { sectors: [...SEED_SECTORS], equipments, defects, users: [...SEED_USERS], audit };
}

function describeAction(action: AuditActionType, asset: string, sector: string): string {
  switch (action) {
    case 'EQUIPMENT_CREATE': return `Equipamento ${asset} cadastrado no setor ${sector}.`;
    case 'EQUIPMENT_UPDATE': return `Equipamento ${asset} teve seus dados atualizados.`;
    case 'EQUIPMENT_TRANSFER': return `Equipamento ${asset} transferido para o setor ${sector}.`;
    case 'EQUIPMENT_SWAP': return `Equipamento ${asset} substituído em campo.`;
    case 'REPORT_GENERATED': return 'Relatório de inventário gerado em PDF.';
    case 'USER_CREATE': return 'Novo usuário cadastrado no sistema.';
    case 'USER_UPDATE': return 'Dados de usuário atualizados.';
    case 'LOGIN': return 'Autenticação realizada com sucesso.';
    case 'LOGOUT': return 'Sessão encerrada pelo usuário.';
    default: return 'Ação registrada.';
  }
}
