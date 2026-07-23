/**
 * Estado da demonstração — substitui o backend Spring Boot.
 *
 * Reimplementa em memória as regras de negócio do sistema real, porque são elas
 * que dão sentido à demo:
 *   - status inicial derivado do contexto (Strategy)
 *   - limpeza do responsável em status que não comportam uso
 *   - troca (swap) atômica entre dois equipamentos
 *   - defeito preserva o status anterior e o devolve na resolução
 *   - trilha de auditoria a cada operação
 *
 * Persistido em localStorage para o visitante poder recarregar a página sem
 * perder o que fez.
 */
import type {
  AuditActionType,
  AuditLog,
  CreateEquipmentDTO,
  CreateSectorDTO,
  CreateUserRequest,
  DefectResponse,
  EquipmentResponseDTO,
  EquipmentStatus,
  MoveEquipmentDTO,
  SectorResponseDTO,
  SwapEquipmentDTO,
  UpdateUserRequest,
  UserResponse,
} from '../types';
import { buildSeed, STORAGE_SECTOR } from './seed';

/**
 * Versionado: mudar a chave descarta estados antigos incompatíveis.
 * v2 — remoção do perfil DEV. Sem ele ninguém desligaria o modo de manutenção,
 * então um estado v1 com manutenção ativa deixaria o visitante preso no 503.
 */
const STORAGE_KEY = 'sgp-demo-state-v2';

export interface MaintenanceState {
  active: boolean;
  message: string | null;
  windowStart: string | null;
  expectedReturn: string | null;
  announcementEnabled: boolean;
  announcementMessage: string | null;
  announcementScheduledAt: string | null;
}

export interface DemoState {
  sectors: SectorResponseDTO[];
  equipments: EquipmentResponseDTO[];
  defects: DefectResponse[];
  users: UserResponse[];
  audit: AuditLog[];
  /** username da sessão ativa, ou null. */
  session: string | null;
  maintenance: MaintenanceState;
}

// ─── Erro de negócio ──────────────────────────────────────────────────────────

export class DemoError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DemoError';
    this.status = status;
  }
}

// ─── Persistência ─────────────────────────────────────────────────────────────

function freshState(): DemoState {
  const seed = buildSeed();
  return {
    ...seed,
    session: null,
    maintenance: {
      active: false,
      message: 'Estamos realizando uma manutenção programada. O sistema retorna em breve.',
      windowStart: null,
      expectedReturn: null,
      announcementEnabled: false,
      announcementMessage: null,
      announcementScheduledAt: null,
    },
  };
}

let state: DemoState = load();

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    // localStorage indisponível ou JSON corrompido → recomeça do seed.
  }
  const fresh = freshState();
  persist(fresh);
  return fresh;
}

function persist(s: DemoState = state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Modo privado / cota cheia: a demo segue funcionando só em memória.
  }
}

export function getState(): DemoState {
  return state;
}

/** Recomeça a demonstração do zero (botão "Resetar dados"). */
export function resetDemo() {
  state = freshState();
  persist();
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function newId(): string {
  const hex = (n: number) => Math.floor(Math.random() * 16 ** n).toString(16).padStart(n, '0');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`;
}

const nowIso = () => new Date().toISOString();

/** Espelha EquipmentStatus.shouldClearUser() do backend. */
function shouldClearUser(status: EquipmentStatus): boolean {
  return status === 'DISPONIVEL'
    || status === 'INSERVIVEL'
    || status === 'MANUTENCAO'
    || status === 'BAIXADO'
    || status === 'EXCLUIDO';
}

export function currentUser(): UserResponse | null {
  if (!state.session) return null;
  return state.users.find((u) => u.username === state.session) ?? null;
}

function actor(): string {
  return state.session ?? 'sistema';
}

function audit(actionType: AuditActionType, entityType: string, entityId: string, description: string) {
  state.audit.unshift({
    id: newId(),
    actorUsername: actor(),
    actionType,
    entityType,
    entityId,
    description,
    ipAddress: '10.20.0.1',
    createdAt: nowIso(),
  });
}

function findSector(id: string): SectorResponseDTO {
  const s = state.sectors.find((x) => x.id === id);
  if (!s) throw new DemoError(404, 'Setor não encontrado.');
  return s;
}

function findEquipment(id: string): EquipmentResponseDTO {
  const e = state.equipments.find((x) => x.id === id);
  if (!e) throw new DemoError(404, 'Equipamento não encontrado.');
  return e;
}

function refreshDefectFlag(equipmentId: string) {
  const eq = state.equipments.find((e) => e.id === equipmentId);
  if (eq) eq.hasOpenDefect = state.defects.some((d) => d.equipmentId === equipmentId && d.status === 'ABERTO');
}

// ─── Sessão ───────────────────────────────────────────────────────────────────

export function login(username: string): UserResponse {
  const user = state.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user) throw new DemoError(401, 'Usuário ou senha inválidos.');
  if (user.enabled === false) throw new DemoError(401, 'Conta desativada. Acesso não autorizado.');
  // O perfil DEV (Central de Manutenção e inspeção do ambiente) existe no sistema
  // real, mas está fora da demonstração. Barra aqui também, e não só na lista de
  // contas, para que ninguém entre digitando o login manualmente.
  if (user.role === 'DEV') throw new DemoError(401, 'Perfil indisponível no modo demonstração.');

  user.previousLoginAt = user.lastLoginAt;
  user.lastLoginAt = nowIso();
  state.session = user.username;
  audit('LOGIN', 'User', user.id, 'Autenticação realizada com sucesso.');
  persist();
  return user;
}

export function logout() {
  const user = currentUser();
  if (user) audit('LOGOUT', 'User', user.id, 'Sessão encerrada pelo usuário.');
  state.session = null;
  persist();
}

export function updateOwnProfile(fullName: string): UserResponse {
  const user = currentUser();
  if (!user) throw new DemoError(401, 'Não autenticado.');
  user.fullName = fullName;
  audit('USER_UPDATE', 'User', user.id, 'Perfil atualizado pelo próprio usuário.');
  persist();
  return user;
}

// ─── Setores ──────────────────────────────────────────────────────────────────

export function listSectors(): SectorResponseDTO[] {
  return [...state.sectors].sort((a, b) => a.acronym.localeCompare(b.acronym));
}

export function createSector(dto: CreateSectorDTO): SectorResponseDTO {
  const acronym = dto.acronym.trim().toUpperCase();
  if (state.sectors.some((s) => s.acronym.toUpperCase() === acronym)) {
    throw new DemoError(409, 'Já existe um setor com esta sigla.');
  }
  const sector: SectorResponseDTO = { id: newId(), acronym, fullName: dto.fullName.trim() };
  state.sectors.push(sector);
  persist();
  return sector;
}

export function updateSector(id: string, dto: CreateSectorDTO): SectorResponseDTO {
  const sector = findSector(id);
  const acronym = dto.acronym.trim().toUpperCase();
  if (state.sectors.some((s) => s.id !== id && s.acronym.toUpperCase() === acronym)) {
    throw new DemoError(409, 'Já existe um setor com esta sigla.');
  }
  sector.acronym = acronym;
  sector.fullName = dto.fullName.trim();
  // Equipamentos guardam uma cópia do setor: propaga a alteração.
  state.equipments.forEach((e) => {
    if (e.currentSector.id === id) e.currentSector = { ...sector };
  });
  persist();
  return sector;
}

export function deleteSector(id: string) {
  const inUse = state.equipments.some((e) => e.currentSector.id === id);
  if (inUse) throw new DemoError(409, 'Não é possível excluir um setor que possui equipamentos vinculados.');
  state.sectors = state.sectors.filter((s) => s.id !== id);
  persist();
}

// ─── Equipamentos ─────────────────────────────────────────────────────────────

/**
 * Strategy de status inicial (espelha EquipmentStrategyFactory do backend):
 *   sem patrimônio                → PROVISORIO
 *   com patrimônio, setor estoque → DISPONIVEL
 *   com patrimônio, outro setor   → EM_USO
 */
function resolveInitialStatus(assetNumber: string | undefined, sector: SectorResponseDTO): EquipmentStatus {
  const provisional = !assetNumber || assetNumber.trim() === '' || assetNumber.trim() === 'TEMP-';
  if (provisional) return 'PROVISORIO';
  return sector.acronym.toUpperCase() === STORAGE_SECTOR ? 'DISPONIVEL' : 'EM_USO';
}

export function listEquipments(): EquipmentResponseDTO[] {
  return [...state.equipments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createEquipment(dto: CreateEquipmentDTO): EquipmentResponseDTO {
  const asset = dto.assetNumber?.trim();
  if (asset && asset !== 'TEMP-' && state.equipments.some((e) => e.assetNumber === asset)) {
    throw new DemoError(409, 'Já existe um equipamento com este número de patrimônio.');
  }
  const sector = findSector(dto.sectorId);
  const status = dto.status ?? resolveInitialStatus(asset, sector);

  const equipment: EquipmentResponseDTO = {
    id: newId(),
    assetNumber: asset && asset !== 'TEMP-' ? asset : `PROV-${Math.floor(10000 + Math.random() * 89999)}`,
    serialNumber: dto.serialNumber?.trim() || undefined,
    description: dto.description?.trim() || undefined,
    hostname: dto.hostname?.trim() || undefined,
    ipAddress: dto.ipAddress?.trim() || undefined,
    brand: dto.brand.trim(),
    type: dto.type,
    status,
    equipmentUser: shouldClearUser(status) ? undefined : dto.equipmentUser?.trim() || undefined,
    currentSector: { ...sector },
    createdAt: nowIso(),
    hasOpenDefect: false,
  };

  state.equipments.unshift(equipment);
  audit('EQUIPMENT_CREATE', 'Equipment', equipment.id, `Equipamento ${equipment.assetNumber} cadastrado no setor ${sector.acronym}.`);
  persist();
  return equipment;
}

export function updateEquipment(id: string, dto: CreateEquipmentDTO): EquipmentResponseDTO {
  const eq = findEquipment(id);
  const asset = dto.assetNumber?.trim();
  if (asset && state.equipments.some((e) => e.id !== id && e.assetNumber === asset)) {
    throw new DemoError(409, 'Já existe um equipamento com este número de patrimônio.');
  }
  const sector = dto.sectorId ? findSector(dto.sectorId) : null;

  if (asset) eq.assetNumber = asset;
  eq.serialNumber = dto.serialNumber?.trim() || undefined;
  eq.description = dto.description?.trim() || undefined;
  eq.hostname = dto.hostname?.trim() || undefined;
  eq.ipAddress = dto.ipAddress?.trim() || undefined;
  eq.brand = dto.brand?.trim() ?? eq.brand;
  eq.type = dto.type ?? eq.type;
  if (sector) eq.currentSector = { ...sector };
  if (dto.status) eq.status = dto.status;
  eq.equipmentUser = shouldClearUser(eq.status) ? undefined : dto.equipmentUser?.trim() || undefined;

  audit('EQUIPMENT_UPDATE', 'Equipment', eq.id, `Equipamento ${eq.assetNumber} teve seus dados atualizados.`);
  persist();
  return eq;
}

export function deleteEquipment(id: string) {
  const eq = findEquipment(id);
  state.equipments = state.equipments.filter((e) => e.id !== id);
  state.defects = state.defects.filter((d) => d.equipmentId !== id);
  audit('EQUIPMENT_DELETE', 'Equipment', id, `Equipamento ${eq.assetNumber} excluído do sistema.`);
  persist();
}

export function moveEquipment(dto: MoveEquipmentDTO) {
  const eq = findEquipment(dto.equipmentId);
  const target = findSector(dto.targetSectorId);
  const status = dto.targetStatus ?? eq.status;

  eq.currentSector = { ...target };
  eq.status = status;
  eq.equipmentUser = shouldClearUser(status) ? undefined : dto.targetUser?.trim() || undefined;

  audit('EQUIPMENT_TRANSFER', 'Equipment', eq.id, `Equipamento ${eq.assetNumber} transferido para o setor ${target.acronym}.`);
  persist();
}

/**
 * Troca em campo — a operação mais rica do sistema, executada de forma atômica:
 *   1. o equipamento novo assume setor, status EM_USO e responsável do antigo;
 *   2. o antigo, se defeituoso, abre defeito e vai para o estoque em MANUTENCAO;
 *      se não, volta ao setor de origem do novo (DISPONIVEL se for o estoque).
 */
export function swapEquipment(dto: SwapEquipmentDTO) {
  const outgoing = findEquipment(dto.outgoingEquipmentId);
  const incoming = findEquipment(dto.incomingEquipmentId);
  if (outgoing.id === incoming.id) {
    throw new DemoError(400, 'Selecione dois equipamentos diferentes.');
  }

  const originSector = { ...incoming.currentSector };
  const originUser = incoming.equipmentUser;

  // 1. Instala o novo no lugar do antigo.
  incoming.currentSector = { ...outgoing.currentSector };
  incoming.status = 'EM_USO';
  incoming.equipmentUser = outgoing.equipmentUser;

  // 2. Destino do antigo.
  if (dto.isDefective) {
    const storage = state.sectors.find((s) => s.acronym.toUpperCase() === STORAGE_SECTOR) ?? outgoing.currentSector;
    outgoing.currentSector = { ...storage };
    outgoing.status = 'MANUTENCAO';
    outgoing.equipmentUser = undefined;
    state.defects.unshift({
      id: newId(),
      equipmentId: outgoing.id,
      description: dto.defectDescription?.trim() || 'Defeito relatado durante substituição em campo.',
      reportedAt: nowIso(),
      reportedBy: actor(),
      resolvedAt: null,
      status: 'ABERTO',
    });
    outgoing.hasOpenDefect = true;
  } else {
    const backToStorage = originSector.acronym.toUpperCase() === STORAGE_SECTOR;
    outgoing.currentSector = originSector;
    outgoing.status = backToStorage ? 'DISPONIVEL' : 'EM_USO';
    outgoing.equipmentUser = backToStorage ? undefined : originUser;
  }

  audit('EQUIPMENT_SWAP', 'Equipment', outgoing.id,
    `Equipamento ${outgoing.assetNumber} substituído por ${incoming.assetNumber}${dto.isDefective ? ' (enviado para manutenção)' : ''}.`);
  persist();
}

// ─── Defeitos ─────────────────────────────────────────────────────────────────

/** previousStatus fica fora do DTO público, como no backend (coluna interna). */
const previousStatusByDefect = new Map<string, EquipmentStatus>();

export function listDefects(equipmentId: string, filters: { status?: string; year?: number; month?: number }): DefectResponse[] {
  return state.defects
    .filter((d) => d.equipmentId === equipmentId)
    .filter((d) => (filters.status ? d.status === filters.status : true))
    .filter((d) => {
      if (!filters.year) return true;
      const dt = new Date(d.reportedAt);
      if (dt.getFullYear() !== Number(filters.year)) return false;
      if (filters.month && dt.getMonth() + 1 !== Number(filters.month)) return false;
      return true;
    })
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
}

export function listAllDefects(): DefectResponse[] {
  return [...state.defects].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
}

export function createDefect(equipmentId: string, description: string): DefectResponse {
  const eq = findEquipment(equipmentId);
  const defect: DefectResponse = {
    id: newId(),
    equipmentId,
    description: description.trim(),
    reportedAt: nowIso(),
    reportedBy: actor(),
    resolvedAt: null,
    status: 'ABERTO',
  };
  // Guarda o status anterior para devolvê-lo na resolução (migration V15 do backend).
  previousStatusByDefect.set(defect.id, eq.status);
  state.defects.unshift(defect);
  eq.status = 'MANUTENCAO';
  eq.equipmentUser = undefined;
  eq.hasOpenDefect = true;
  audit('EQUIPMENT_UPDATE', 'Equipment', eq.id, `Defeito registrado para o equipamento ${eq.assetNumber}.`);
  persist();
  return defect;
}

export function updateDefect(defectId: string, description: string): DefectResponse {
  const defect = state.defects.find((d) => d.id === defectId);
  if (!defect) throw new DemoError(404, 'Defeito não encontrado.');
  defect.description = description.trim();
  persist();
  return defect;
}

export function resolveDefect(defectId: string): DefectResponse {
  const defect = state.defects.find((d) => d.id === defectId);
  if (!defect) throw new DemoError(404, 'Defeito não encontrado.');
  defect.status = 'RESOLVIDO';
  defect.resolvedAt = nowIso();

  const eq = state.equipments.find((e) => e.id === defect.equipmentId);
  if (eq) {
    // Devolve ao status anterior; sem registro, cai no estoque como DISPONIVEL.
    const previous = previousStatusByDefect.get(defect.id);
    eq.status = previous && previous !== 'MANUTENCAO' ? previous : 'DISPONIVEL';
    if (shouldClearUser(eq.status)) eq.equipmentUser = undefined;
    previousStatusByDefect.delete(defect.id);
    refreshDefectFlag(eq.id);
    audit('EQUIPMENT_UPDATE', 'Equipment', eq.id, `Defeito do equipamento ${eq.assetNumber} marcado como resolvido.`);
  }
  persist();
  return defect;
}

// ─── Métricas ─────────────────────────────────────────────────────────────────

function emptyKpi() {
  return {
    totalDisponivel: 0, totalEmUso: 0, totalProvisorio: 0, totalManutencao: 0,
    totalBaixado: 0, totalExcluido: 0, totalInservivel: 0, totalGeral: 0,
  };
}

function accumulate(block: ReturnType<typeof emptyKpi>, status: EquipmentStatus) {
  const map: Record<EquipmentStatus, keyof ReturnType<typeof emptyKpi>> = {
    DISPONIVEL: 'totalDisponivel',
    EM_USO: 'totalEmUso',
    PROVISORIO: 'totalProvisorio',
    MANUTENCAO: 'totalManutencao',
    BAIXADO: 'totalBaixado',
    EXCLUIDO: 'totalExcluido',
    INSERVIVEL: 'totalInservivel',
  };
  block[map[status]] += 1;
  block.totalGeral += 1;
}

export function dashboardStats() {
  const kpiPcs = emptyKpi();
  const kpiEquipamentos = emptyKpi();
  state.equipments.forEach((e) => {
    accumulate(kpiEquipamentos, e.status);
    if (e.type === 'PC' || e.type === 'NOTEBOOK') accumulate(kpiPcs, e.status);
  });
  return { kpiPcs, kpiEquipamentos };
}

export function sectorStats() {
  return state.sectors.map((sector) => {
    const items = state.equipments.filter((e) => e.currentSector.id === sector.id);
    const distributionByType: Record<string, number> = {};
    items.forEach((e) => { distributionByType[e.type] = (distributionByType[e.type] ?? 0) + 1; });
    return {
      acronym: sector.acronym,
      fullName: sector.fullName,
      totalItens: items.length,
      distributionByType,
    };
  }).sort((a, b) => b.totalItens - a.totalItens);
}

export function brands(): string[] {
  return [...new Set(state.equipments.map((e) => e.brand))].sort();
}

// ─── Usuários ─────────────────────────────────────────────────────────────────

export function listUsers(): UserResponse[] {
  return [...state.users].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** Espelha UsernameGenerator: nome.sobrenome, sufixo numérico em colisão. */
export function suggestUsernames(fullName: string): string[] {
  const parts = fullName.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s-]/g, '')
    .split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const middle = parts.length > 2 ? parts[1] : null;

  const candidates = [`${first}.${last}`, middle ? `${first}.${middle}` : null, `${first}.${last[0]}`]
    .filter((c): c is string => Boolean(c));

  const taken = new Set(state.users.map((u) => u.username));
  return candidates.map((base) => {
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}${n}`)) n++;
    return `${base}${n}`;
  }).slice(0, 3);
}

function tempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${out}#1`;
}

export function createUser(dto: CreateUserRequest) {
  const username = dto.username?.trim() || suggestUsernames(dto.fullName)[0] || 'usuario';
  if (state.users.some((u) => u.username === username)) {
    throw new DemoError(409, 'Já existe um usuário com este login.');
  }
  if (state.users.some((u) => u.email.toLowerCase() === dto.email.trim().toLowerCase())) {
    throw new DemoError(409, 'Já existe um usuário com este e-mail.');
  }
  const user: UserResponse = {
    id: newId(),
    username,
    email: dto.email.trim(),
    fullName: dto.fullName.trim(),
    role: dto.role,
    enabled: true,
    mustChangePassword: true,
  };
  state.users.push(user);
  audit('USER_CREATE', 'User', user.id, `Usuário ${username} cadastrado com perfil ${dto.role}.`);
  persist();
  return { ...user, enabled: true, mustChangePassword: true, temporaryPassword: tempPassword() };
}

export function updateUser(id: string, dto: UpdateUserRequest): UserResponse {
  const user = state.users.find((u) => u.id === id);
  if (!user) throw new DemoError(404, 'Usuário não encontrado.');
  if (dto.email !== undefined) user.email = dto.email.trim();
  if (dto.fullName !== undefined) user.fullName = dto.fullName.trim();
  if (dto.role !== undefined) user.role = dto.role;
  if (dto.enabled !== undefined) user.enabled = dto.enabled;
  audit('USER_UPDATE', 'User', user.id, `Dados do usuário ${user.username} atualizados.`);
  persist();
  return user;
}

export function deleteUser(id: string) {
  const user = state.users.find((u) => u.id === id);
  if (!user) throw new DemoError(404, 'Usuário não encontrado.');
  if (user.username === state.session) throw new DemoError(409, 'Não é possível excluir o próprio usuário.');
  state.users = state.users.filter((u) => u.id !== id);
  audit('USER_DELETE', 'User', id, `Usuário ${user.username} excluído.`);
  persist();
}

export function adminResetPassword(id: string): { temporaryPassword: string } {
  const user = state.users.find((u) => u.id === id);
  if (!user) throw new DemoError(404, 'Usuário não encontrado.');
  user.mustChangePassword = true;
  audit('USER_PASSWORD_RESET', 'User', user.id, `Senha temporária gerada para ${user.username}.`);
  persist();
  return { temporaryPassword: tempPassword() };
}

export function generateRecoveryCode(id: string): { recoveryCode: string } {
  const user = state.users.find((u) => u.id === id);
  if (!user) throw new DemoError(404, 'Usuário não encontrado.');
  if (user.role !== 'ADMIN' && user.role !== 'DEV') {
    throw new DemoError(400, 'Códigos de recuperação são exclusivos de contas ADMIN/DEV.');
  }
  user.hasRecoveryCode = true;
  audit('USER_RECOVERY_CODE_GENERATED', 'User', user.id, `Código de recuperação gerado para ${user.username}.`);
  persist();
  const group = () => Math.random().toString(36).slice(2, 7).toUpperCase();
  return { recoveryCode: `${group()}-${group()}-${group()}-${group()}` };
}

export function securityStatus() {
  const activeAdminCount = state.users.filter((u) => u.enabled !== false && (u.role === 'ADMIN' || u.role === 'DEV')).length;
  return { activeAdminCount, needsSecondAdmin: activeAdminCount < 2 };
}

// ─── Auditoria ────────────────────────────────────────────────────────────────

export function listAudit(page: number, size: number, actorUsername?: string, actionType?: string) {
  const filtered = state.audit
    .filter((a) => (actorUsername ? a.actorUsername.toLowerCase().includes(actorUsername.toLowerCase()) : true))
    .filter((a) => (actionType ? a.actionType === actionType : true));
  const start = page * size;
  return {
    content: filtered.slice(start, start + size),
    totalElements: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / size)),
    number: page,
    size,
  };
}

export function recordReportGenerated(kind: string) {
  audit('REPORT_GENERATED', 'System', '', `Relatório (${kind}) gerado em PDF.`);
  persist();
}

// ─── Manutenção ───────────────────────────────────────────────────────────────

export function getMaintenance(): MaintenanceState {
  return state.maintenance;
}

export function setMaintenance(active: boolean) {
  state.maintenance.active = active;
  audit(active ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED', 'System', '',
    active ? 'Modo de manutenção ativado.' : 'Modo de manutenção desativado.');
  persist();
}

export function updateMaintenanceSettings(payload: { message?: string; windowStart?: string; expectedReturn?: string }) {
  if (payload.message !== undefined) state.maintenance.message = payload.message;
  if (payload.windowStart !== undefined) state.maintenance.windowStart = payload.windowStart || null;
  if (payload.expectedReturn !== undefined) state.maintenance.expectedReturn = payload.expectedReturn || null;
  audit('MAINTENANCE_SETTINGS_UPDATED', 'System', '', 'Configurações da tela de manutenção atualizadas.');
  persist();
}

export function updateAnnouncement(payload: { enabled: boolean; message?: string; scheduledAt?: string }) {
  state.maintenance.announcementEnabled = payload.enabled;
  state.maintenance.announcementMessage = payload.message ?? null;
  state.maintenance.announcementScheduledAt = payload.scheduledAt || null;
  audit('ANNOUNCEMENT_UPDATED', 'System', '', 'Aviso do sistema atualizado.');
  persist();
}
