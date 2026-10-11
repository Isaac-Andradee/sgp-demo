/**
 * Estado da demonstração — substitui o backend Spring Boot.
 *
 * Reimplementa em memória as regras de negócio do sistema real, porque são elas
 * que dão sentido à demo:
 *   - status inicial derivado do contexto (Strategy)
 *   - limpeza do responsável em status que não comportam uso
 *   - troca (swap) atômica entre dois equipamentos
 *   - defeito preserva o status anterior e o devolve na resolução
 *   - trilha de auditoria a cada operação, com busca, filtros e exportação
 *   - permissões por perfil que o backend impõe (403), além das que a UI esconde
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
 * v3 — remoção do perfil DEV e da simulação de modo de manutenção.
 * v4 — SGPT: trilha de auditoria maior, para a busca e a paginação terem o que mostrar.
 * v5 — status anterior dos defeitos persistido e histórico com defeitos resolvidos no mês corrente.
 */
const STORAGE_KEY = 'sgp-demo-state-v5';

export interface DemoState {
  sectors: SectorResponseDTO[];
  equipments: EquipmentResponseDTO[];
  defects: DefectResponse[];
  /**
   * Status do equipamento antes do defeito, por id do defeito — fica fora do DTO público, como a
   * coluna previous_status do backend. Persistido junto do estado para sobreviver ao recarregamento.
   */
  defectPreviousStatus: Record<string, EquipmentStatus>;
  users: UserResponse[];
  audit: AuditLog[];
  /** username da sessão ativa, ou null. */
  session: string | null;
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
  return { ...seed, session: null };
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

/**
 * Espelha os @PreAuthorize do backend: a UI já esconde a ação, mas a regra vale
 * mesmo que alguém chame a API diretamente.
 */
function requireRole(roles: UserResponse['role'][], message = 'Você não tem permissão para esta ação.') {
  const user = currentUser();
  if (!user) throw new DemoError(401, 'Não autenticado.');
  if (!roles.includes(user.role)) throw new DemoError(403, message);
}

const EDITORS: UserResponse['role'][] = ['ADMIN', 'USER'];

/** Excluir é só de ADMIN — inclusive pelo caminho de gravar o status EXCLUIDO. */
function requireExclusionPermission(status?: EquipmentStatus) {
  if (status === 'EXCLUIDO') requireRole(['ADMIN'], 'Somente administradores podem excluir equipamentos.');
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
  requireRole(EDITORS);
  requireExclusionPermission(dto.status);
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
  requireRole(EDITORS);
  requireExclusionPermission(dto.status);
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
  requireRole(['ADMIN'], 'Somente administradores podem excluir equipamentos.');
  const eq = findEquipment(id);
  state.equipments = state.equipments.filter((e) => e.id !== id);
  state.defects = state.defects.filter((d) => d.equipmentId !== id);
  audit('EQUIPMENT_DELETE', 'Equipment', id, `Equipamento ${eq.assetNumber} excluído do sistema.`);
  persist();
}

export function moveEquipment(dto: MoveEquipmentDTO) {
  requireRole(EDITORS);
  requireExclusionPermission(dto.targetStatus);
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
  requireRole(EDITORS);
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
    outgoing.equipmentUser = undefined;
    // Saiu do setor e foi para o almoxarifado: consertado, volta como DISPONIVEL — não EM_USO sem dono.
    openDefectOnSwap(outgoing, dto.defectDescription ?? '');
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

/**
 * Filtros de GET /equipments/{id}/defects, iguais aos do backend: com ano e/ou mês, a busca é pelo
 * mês de **resolução** (a tela de histórico lista o que foi resolvido em cada período); só o mês,
 * sem ano, considera o ano corrente.
 */
export function listDefects(equipmentId: string, filters: { status?: string; year?: number; month?: number }): DefectResponse[] {
  const byEquipment = state.defects
    .filter((d) => d.equipmentId === equipmentId)
    .filter((d) => (filters.status ? d.status === filters.status : true))
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
  if (!filters.year && !filters.month) return byEquipment;

  const year = filters.year ?? new Date().getFullYear();
  const start = filters.month ? new Date(year, filters.month - 1, 1) : new Date(year, 0, 1);
  const end = filters.month ? new Date(year, filters.month, 1) : new Date(year + 1, 0, 1);
  return byEquipment.filter((d) => {
    if (!d.resolvedAt) return false;
    const resolved = new Date(d.resolvedAt);
    return resolved >= start && resolved < end;
  });
}

export function listAllDefects(): DefectResponse[] {
  return [...state.defects].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
}

function openDefectsOf(equipmentId: string): DefectResponse[] {
  return state.defects.filter((d) => d.equipmentId === equipmentId && d.status === 'ABERTO');
}

const DEFAULT_DEFECT_DESCRIPTION = 'Defeito registrado';

function newDefect(eq: EquipmentResponseDTO, description: string, previous: EquipmentStatus | undefined): DefectResponse {
  const defect: DefectResponse = {
    id: newId(),
    equipmentId: eq.id,
    description: description.trim() || DEFAULT_DEFECT_DESCRIPTION,
    reportedAt: nowIso(),
    reportedBy: actor(),
    resolvedAt: null,
    status: 'ABERTO',
  };
  state.defects.unshift(defect);
  if (previous) state.defectPreviousStatus[defect.id] = previous;
  eq.hasOpenDefect = true;
  return defect;
}

function sendToMaintenance(eq: EquipmentResponseDTO) {
  eq.status = 'MANUTENCAO';
  if (shouldClearUser(eq.status)) eq.equipmentUser = undefined;
}

/**
 * Espelha EquipmentDefectService.create: o primeiro defeito aberto manda o equipamento para
 * MANUTENCAO e guarda o status em que ele estava; os seguintes herdam esse mesmo status. Assim, o
 * último defeito resolvido devolve o equipamento ao estado de antes do primeiro, em qualquer ordem.
 */
function openDefect(eq: EquipmentResponseDTO, description: string): DefectResponse {
  const open = openDefectsOf(eq.id);
  const previous = open.length === 0
    ? eq.status
    : open.map((d) => state.defectPreviousStatus[d.id]).find(Boolean);
  if (open.length === 0) sendToMaintenance(eq);
  return newDefect(eq, description, previous);
}

/**
 * Espelha EquipmentDefectService.createOnSwap: o equipamento retirado vai para o almoxarifado sem
 * responsável, então, consertado, volta como DISPONIVEL — e os defeitos já abertos também.
 */
function openDefectOnSwap(eq: EquipmentResponseDTO, description: string): DefectResponse {
  const open = openDefectsOf(eq.id);
  if (open.length === 0) sendToMaintenance(eq);
  else open.forEach((d) => { state.defectPreviousStatus[d.id] = 'DISPONIVEL'; });
  return newDefect(eq, description, 'DISPONIVEL');
}

export function createDefect(equipmentId: string, description: string): DefectResponse {
  requireRole(EDITORS);
  const eq = findEquipment(equipmentId);
  const defect = openDefect(eq, description);
  audit('EQUIPMENT_UPDATE', 'Equipment', eq.id, `Defeito registrado: ${defect.description}`);
  persist();
  return defect;
}

function findDefect(equipmentId: string, defectId: string): DefectResponse {
  const defect = state.defects.find((d) => d.id === defectId && d.equipmentId === equipmentId);
  if (!defect) throw new DemoError(404, 'Defeito não encontrado.');
  return defect;
}

export function updateDefect(equipmentId: string, defectId: string, description: string): DefectResponse {
  requireRole(EDITORS);
  const defect = findDefect(equipmentId, defectId);
  if (defect.status !== 'ABERTO') throw new DemoError(400, 'Apenas defeitos em aberto podem ser editados.');
  defect.description = description.trim() || DEFAULT_DEFECT_DESCRIPTION;
  audit('EQUIPMENT_UPDATE', 'Equipment', equipmentId, `Defeito editado: ${defect.description}`);
  persist();
  return defect;
}

/**
 * Espelha EquipmentDefectService.resolve: confere a posse antes de gravar (404), recusa defeito já
 * resolvido (400 — a data de resolução é a da primeira vez) e só tira o equipamento de MANUTENCAO
 * quando o último defeito aberto é resolvido. Sem status anterior registrado, o equipamento fica
 * como está.
 */
export function resolveDefect(equipmentId: string, defectId: string): DefectResponse {
  requireRole(EDITORS);
  const defect = findDefect(equipmentId, defectId);
  if (defect.status !== 'ABERTO') throw new DemoError(400, 'Este defeito já foi resolvido.');

  defect.status = 'RESOLVIDO';
  defect.resolvedAt = nowIso();
  const previous = state.defectPreviousStatus[defect.id];
  delete state.defectPreviousStatus[defect.id];

  const eq = state.equipments.find((e) => e.id === equipmentId);
  if (previous) {
    const stillOpen = openDefectsOf(equipmentId);
    if (stillOpen.length === 0) {
      if (eq) {
        eq.status = previous;
        if (shouldClearUser(eq.status)) eq.equipmentUser = undefined;
      }
    } else {
      // Defeito aberto sem status anterior (dado antigo) recebe o do que foi resolvido.
      stillOpen
        .filter((d) => !state.defectPreviousStatus[d.id])
        .forEach((d) => { state.defectPreviousStatus[d.id] = previous; });
    }
  }
  refreshDefectFlag(equipmentId);
  audit('EQUIPMENT_UPDATE', 'Equipment', equipmentId, `Defeito resolvido: ${defect.description}`);
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
// Espelha SearchAuditLogsUseCase + AuditLogSpecifications + AuditReportService.

export interface AuditCriteria {
  from?: string;
  to?: string;
  actor?: string;
  actionTypes?: string[];
  entityType?: string;
  ip?: string;
  q?: string;
  sort?: string;
  direction?: string;
}

const AUDIT_SORTABLE = new Set(['createdAt', 'actorUsername', 'actionType', 'entityType', 'ipAddress']);
export const AUDIT_PDF_MAX_ROWS = 5_000;
export const AUDIT_CSV_MAX_ROWS = 100_000;

/** Data local AAAA-MM-DD de um ISO (o período do backend é em dias locais). */
function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Filtros combinados com E; período inclusivo; ordenação estável (desempate pelo mais recente). */
export function searchAudit(c: AuditCriteria): AuditLog[] {
  requireRole(['ADMIN']);
  if (c.from && c.to && c.from > c.to) {
    throw new DemoError(400, 'A data inicial não pode ser posterior à data final.');
  }
  const sort = c.sort || 'createdAt';
  if (!AUDIT_SORTABLE.has(sort)) throw new DemoError(400, `Não é possível ordenar por '${sort}'.`);
  const dir = (c.direction || 'desc').toLowerCase();
  if (dir !== 'asc' && dir !== 'desc') throw new DemoError(400, 'Direção de ordenação inválida: use asc ou desc.');

  const actorTerm = c.actor?.trim().toLowerCase();
  const ip = c.ip?.trim();
  const text = c.q?.trim();
  const textLower = text?.toLowerCase();
  const types = c.actionTypes?.filter(Boolean) ?? [];

  const filtered = state.audit.filter((a) => {
    const day = localDay(a.createdAt);
    if (c.from && day < c.from) return false;
    if (c.to && day > c.to) return false;
    if (actorTerm && !a.actorUsername?.toLowerCase().includes(actorTerm)) return false;
    if (types.length && !types.includes(a.actionType)) return false;
    if (c.entityType && a.entityType !== c.entityType.trim()) return false;
    if (ip && !a.ipAddress?.startsWith(ip)) return false;
    if (textLower && !(a.description?.toLowerCase().includes(textLower) || a.entityId === text)) return false;
    return true;
  });

  const key = sort as keyof AuditLog;
  const sign = dir === 'asc' ? 1 : -1;
  return filtered.sort((x, y) => {
    const primary = String(x[key] ?? '').localeCompare(String(y[key] ?? '')) * sign;
    if (primary !== 0 || sort === 'createdAt') return primary || y.id.localeCompare(x.id);
    return y.createdAt.localeCompare(x.createdAt) || y.id.localeCompare(x.id);
  });
}

export function listAudit(c: AuditCriteria, page: number, size: number) {
  if (page < 0) throw new DemoError(400, 'A página não pode ser negativa.');
  if (size < 1 || size > 100) throw new DemoError(400, 'O tamanho da página deve estar entre 1 e 100.');
  const all = searchAudit(c);
  const content = all.slice(page * size, page * size + size);
  const totalPages = Math.ceil(all.length / size);
  return {
    content, page, size,
    totalElements: all.length,
    totalPages,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

/** Autores e entidades que já aparecem no log — alimentam os seletores da tela. */
export function auditFilterOptions() {
  requireRole(['ADMIN']);
  const distinct = (values: (string | undefined)[]) =>
    [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
  return {
    actors: distinct(state.audit.map((a) => a.actorUsername)),
    entityTypes: distinct(state.audit.map((a) => a.entityType)),
  };
}

/** Busca para exportação: mesmos filtros e ordenação, sem paginação, com o limite do formato. */
export function auditForReport(c: AuditCriteria, format: 'pdf' | 'csv'): AuditLog[] {
  const all = searchAudit(c);
  const max = format === 'pdf' ? AUDIT_PDF_MAX_ROWS : AUDIT_CSV_MAX_ROWS;
  if (all.length > max) {
    const hint = format === 'pdf' ? ' Refine os filtros ou exporte em CSV.' : ' Refine os filtros.';
    throw new DemoError(400, `A consulta tem ${all.length.toLocaleString('pt-BR')} eventos; o limite deste formato é ${max.toLocaleString('pt-BR')}.${hint}`);
  }
  return all;
}

/** Mesmas entidades do backend: "Report" (inventário, resumo, auditoria) e "EquipmentSheet" (ficha). */
export function recordReportGenerated(entityType: 'Report' | 'EquipmentSheet', entityId: string, description: string) {
  audit('REPORT_GENERATED', entityType, entityId, description);
  persist();
}
