// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'USER' | 'VIEWER' | 'DEV';

export type EquipmentType =
  | 'PC'
  | 'MONITOR'
  | 'TECLADO'
  | 'MOUSE'
  | 'NOTEBOOK'
  | 'IMPRESSORA'
  | 'ROTEADOR'
  | 'SWITCH'
  | 'SERVIDOR'
  | 'ESTABILIZADOR'
  | 'NOBREAK'
  | 'ROTULADORA'
  /** NAS, SAN, discos externos, etc. */
  | 'ARMAZENAMENTO'
  | 'OUTROS';

export type EquipmentStatus =
  | 'DISPONIVEL'
  | 'INSERVIVEL'
  | 'PROVISORIO'
  | 'EM_USO'
  | 'MANUTENCAO'
  | 'BAIXADO'
  | 'EXCLUIDO';

// ─── Labels e Cores ──────────────────────────────────────────────────────────

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  PC: 'PC',
  MONITOR: 'Monitor',
  TECLADO: 'Teclado',
  MOUSE: 'Mouse',
  NOTEBOOK: 'Notebook',
  IMPRESSORA: 'Impressora',
  ROTEADOR: 'Roteador',
  SWITCH: 'Switch',
  SERVIDOR: 'Servidor',
  ESTABILIZADOR: 'Estabilizador',
  NOBREAK: 'NoBreak',
  ROTULADORA: 'Rotuladora',
  ARMAZENAMENTO: 'Armazenamento',
  OUTROS: 'Outros',
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  DISPONIVEL: 'Disponível',
  INSERVIVEL: 'Inservível',
  PROVISORIO: 'Provisório',
  EM_USO: 'Em Uso',
  MANUTENCAO: 'Manutenção',
  BAIXADO: 'Baixado',
  EXCLUIDO: 'Excluído',
};

export const EQUIPMENT_STATUS_COLORS: Record<EquipmentStatus, { bg: string; text: string; border: string }> = {
  DISPONIVEL: { bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  EM_USO: { bg: 'bg-sky-50 dark:bg-sky-950/50', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800' },
  PROVISORIO: { bg: 'bg-purple-50 dark:bg-purple-950/50', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  INSERVIVEL: { bg: 'bg-red-50 dark:bg-red-950/50', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  MANUTENCAO: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  BAIXADO: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700' },
  EXCLUIDO: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700' },
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  USER: 'Usuário',
  VIEWER: 'Visualizador',
  DEV: 'Desenvolvedor',
};

export const USER_ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  ADMIN: { bg: 'bg-sky-50 dark:bg-sky-950/50', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800' },
  USER: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700' },
  VIEWER: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  DEV: { bg: 'bg-violet-50 dark:bg-violet-950/50', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800' },
};

export function shouldShowUserField(status: EquipmentStatus): boolean {
  return status === 'EM_USO' || status === 'PROVISORIO';
}

/** Normaliza valor vindo da API (ex.: "Disponivel", "EM USO") para chave do enum. */
export function normalizeEquipmentStatus(s: string | undefined): EquipmentStatus | null {
  if (s == null || s === '') return null;
  const key = String(s).toUpperCase().replace(/\s+/g, '_') as EquipmentStatus;
  return key in EQUIPMENT_STATUS_COLORS ? key : null;
}

/** Retorna label do tipo ou valor bruto/fallback para exibição segura. */
export function getEquipmentTypeLabel(type: EquipmentType | string | undefined): string {
  if (type == null || type === '') return '—';
  const label = (EQUIPMENT_TYPE_LABELS as Record<string, string>)[type];
  return label ?? String(type);
}

/**
 * Indica se o equipamento é "sem patrimônio" (provisório).
 * Backend pode devolver: PROV-xxxxx (legado), TEMP- (só na criação), ou UUID = id do equipamento.
 */
export function isEquipmentWithoutAsset(assetNumber: string | undefined, equipmentId?: string): boolean {
  if (assetNumber == null || assetNumber === '') return true;
  if (assetNumber.startsWith('PROV-') || assetNumber.startsWith('TEMP-')) return true;
  if (equipmentId && assetNumber === equipmentId) return true; // UUID = patrimônio provisório (novo backend)
  return false;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  type: string;
  expiresIn: number;
  username: string;
  fullName: string;
  role: UserRole;
  /** Quando true, o usuário deve trocar a senha antes de usar o sistema (reset por admin / break-glass). */
  mustChangePassword?: boolean;
}

export interface SetupRequest {
  password: string;
  email: string;
  fullName: string;
  /** Opcional: login preferido (firstname.lastname, 3–50 caracteres). Se omitido, o backend gera. */
  username?: string;
}

/** Resposta 201 do POST /setup: JSON com username gerado pelo backend. */
export interface SetupResponse {
  message: string;
  username: string;
}

// ─── Usuários ────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  enabled?: boolean;
  lastLoginAt?: string; // ISO 8601 — login mais recente (usado em listagens de admin)
  /** Login anterior ao atual — exibido como "último acesso" no perfil do usuário. */
  previousLoginAt?: string;
  /** Usuário precisa trocar a senha no próximo acesso (após reset por admin / break-glass). */
  mustChangePassword?: boolean;
  /** Conta ADMIN/DEV possui um código de recuperação configurado. */
  hasRecoveryCode?: boolean;
}

/** Resposta do reset por admin — senha temporária exibida uma única vez. */
export interface AdminResetPasswordResponse {
  temporaryPassword: string;
}

/** Resposta da geração do código de recuperação — exibido uma única vez. */
export interface RecoveryCodeResponse {
  recoveryCode: string;
}

/** Situação de recuperação de acesso: alerta quando há menos de 2 ADMINs ativos. */
export interface SecurityStatusResponse {
  activeAdminCount: number;
  needsSecondAdmin: boolean;
}

/** Requisição de recuperação via código de uso único (Camada 2). */
export interface RecoverWithCodeRequest {
  usernameOrEmail: string;
  recoveryCode: string;
  newPassword: string;
}

// ─── Auditoria ───────────────────────────────────────────────────────────────

export type AuditActionType =
  | 'EQUIPMENT_CREATE'
  | 'EQUIPMENT_UPDATE'
  | 'EQUIPMENT_DELETE'
  | 'EQUIPMENT_SWAP'
  | 'EQUIPMENT_TRANSFER'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_PASSWORD_RESET'
  | 'USER_RECOVERY_CODE_GENERATED'
  | 'PASSWORD_RECOVERED_WITH_CODE'
  | 'REPORT_GENERATED'
  | 'MAINTENANCE_ENABLED'
  | 'MAINTENANCE_DISABLED'
  | 'MAINTENANCE_SETTINGS_UPDATED'
  | 'ANNOUNCEMENT_UPDATED'
  | 'LOGIN'
  | 'LOGOUT';

export const AUDIT_ACTION_LABELS: Record<AuditActionType, string> = {
  EQUIPMENT_CREATE: 'Cadastro de Equipamento',
  EQUIPMENT_UPDATE: 'Atualização de Equipamento',
  EQUIPMENT_DELETE: 'Exclusão de Equipamento',
  EQUIPMENT_SWAP: 'Substituição de Equipamento',
  EQUIPMENT_TRANSFER: 'Transferência de Equipamento',
  USER_CREATE: 'Criação de Usuário',
  USER_UPDATE: 'Atualização de Usuário',
  USER_DELETE: 'Exclusão de Usuário',
  USER_PASSWORD_RESET: 'Reset de Senha (Admin)',
  USER_RECOVERY_CODE_GENERATED: 'Código de Recuperação Gerado',
  PASSWORD_RECOVERED_WITH_CODE: 'Senha Recuperada por Código',
  REPORT_GENERATED: 'Relatório Gerado',
  MAINTENANCE_ENABLED: 'Manutenção Ativada',
  MAINTENANCE_DISABLED: 'Manutenção Desativada',
  MAINTENANCE_SETTINGS_UPDATED: 'Configurações de Manutenção Atualizadas',
  ANNOUNCEMENT_UPDATED: 'Aviso Atualizado',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
};

export const AUDIT_ACTION_COLORS: Record<AuditActionType, { bg: string; text: string; dot: string }> = {
  EQUIPMENT_CREATE: { bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  EQUIPMENT_UPDATE: { bg: 'bg-sky-50 dark:bg-sky-950/50', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
  EQUIPMENT_DELETE: { bg: 'bg-rose-50 dark:bg-rose-950/50', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  EQUIPMENT_SWAP: { bg: 'bg-violet-50 dark:bg-violet-950/50', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  EQUIPMENT_TRANSFER: { bg: 'bg-indigo-50 dark:bg-indigo-950/50', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  USER_CREATE: { bg: 'bg-teal-50 dark:bg-teal-950/50', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  USER_UPDATE: { bg: 'bg-cyan-50 dark:bg-cyan-950/50', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500' },
  USER_DELETE: { bg: 'bg-red-50 dark:bg-red-950/50', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  USER_PASSWORD_RESET: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  USER_RECOVERY_CODE_GENERATED: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  PASSWORD_RECOVERED_WITH_CODE: { bg: 'bg-orange-50 dark:bg-orange-950/50', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  REPORT_GENERATED: { bg: 'bg-indigo-50 dark:bg-indigo-950/50', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  MAINTENANCE_ENABLED: { bg: 'bg-orange-50 dark:bg-orange-950/50', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  MAINTENANCE_DISABLED: { bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  MAINTENANCE_SETTINGS_UPDATED: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  ANNOUNCEMENT_UPDATED: { bg: 'bg-sky-50 dark:bg-sky-950/50', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
  LOGIN: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400 dark:bg-gray-500' },
  LOGOUT: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', dot: 'bg-gray-300 dark:bg-gray-500' },
};

export interface AuditLog {
  id: string;
  actorUsername: string;
  actionType: AuditActionType;
  entityType: string;
  entityId: string;
  description: string;
  ipAddress?: string;
  createdAt: string;
}

export interface CreateUserRequest {
  email: string;
  fullName: string;
  role: UserRole;
  /** Opcional: login preferido (firstname.lastname, 3–50 caracteres). Se omitido, o backend gera. */
  username?: string;
}

/**
 * Resposta do cadastro de usuário. O sistema gera uma senha temporária —
 * exibida uma única vez para o admin repassar — e força a troca no 1º login.
 */
export interface CreateUserResponse {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  enabled: boolean;
  mustChangePassword: boolean;
  temporaryPassword: string;
}

/** Resposta do GET /api/auth/suggested-usernames?fullName=... (público). */
export interface SuggestedUsernamesResponse {
  suggestions: string[];
}

export interface UpdateUserRequest {
  password?: string;
  email?: string;
  fullName?: string;
  role?: UserRole;
  enabled?: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ─── Setores ─────────────────────────────────────────────────────────────────

export interface SectorResponseDTO {
  id: string;
  acronym: string;
  fullName: string;
}

export interface CreateSectorDTO {
  fullName: string;
  acronym: string;
}

// ─── Equipamentos ─────────────────────────────────────────────────────────────

export interface EquipmentResponseDTO {
  id: string;
  assetNumber: string;
  serialNumber?: string;
  description?: string;
  hostname?: string;
  ipAddress?: string;
  brand: string;
  type: EquipmentType;
  status: EquipmentStatus;
  equipmentUser?: string;
  currentSector: SectorResponseDTO;
  createdAt: string;
  /** Indica se o equipamento possui ao menos um defeito com status ABERTO (backend preenche na listagem) */
  hasOpenDefect?: boolean;
}

/** Patrimônio válido; sem patrimônio → S/N; senão fallback. */
export function getEquipmentPrimaryIdentifier(
  e: Pick<EquipmentResponseDTO, 'assetNumber' | 'serialNumber' | 'id'>,
): string {
  if (!isEquipmentWithoutAsset(e.assetNumber, e.id)) {
    return e.assetNumber.trim();
  }
  const serial = e.serialNumber?.trim();
  if (serial) return `S/N ${serial}`;
  return 'Sem patrimônio';
}

/** Texto curto para input/select (patrimônio · tipo marca · setor). */
export function getEquipmentShortLabel(e: EquipmentResponseDTO): string {
  const pat = getEquipmentPrimaryIdentifier(e);
  return `${pat} · ${getEquipmentTypeLabel(e.type)} ${e.brand} · ${e.currentSector.acronym}`;
}

/** Linha secundária para dropdown: serial, hostname, IP, status. */
export function getEquipmentDropdownSecondary(e: EquipmentResponseDTO): string {
  const parts: string[] = [];
  if (e.serialNumber) parts.push(`S/N ${e.serialNumber}`);
  if (e.hostname) parts.push(e.hostname);
  if (e.ipAddress) parts.push(e.ipAddress);
  parts.push(EQUIPMENT_STATUS_LABELS[e.status]);
  return parts.join(' · ');
}

export interface CreateEquipmentDTO {
  assetNumber: string;
  serialNumber?: string;
  description?: string;
  hostname?: string;
  ipAddress?: string;
  brand: string;
  type: EquipmentType;
  status: EquipmentStatus;
  equipmentUser?: string;
  sectorId: string;
}

export interface EquipmentFilterDTO {
  textoBusca?: string;
  marca?: string;
  setorId?: string;
  tipo?: EquipmentType;
  status?: EquipmentStatus;
}

export interface MoveEquipmentDTO {
  equipmentId: string;
  targetSectorId: string;
  targetUser?: string;
  targetStatus: EquipmentStatus;
}

export interface SwapEquipmentDTO {
  outgoingEquipmentId: string;
  incomingEquipmentId: string;
  isDefective: boolean;
  /**
   * Descrição do defeito. O backend DEVE criar apenas um registro na tabela de defeitos
   * e NÃO deve anexar este texto ao campo description do equipamento (evitar mistura de contexto).
   */
  defectDescription?: string;
}

// ─── Defeitos de equipamento ──────────────────────────────────────────────────

export type DefectStatus = "ABERTO" | "RESOLVIDO";

export interface DefectResponse {
  id: string;
  equipmentId: string;
  description: string;
  reportedAt: string;
  reportedBy: string | null;
  resolvedAt: string | null;
  status: DefectStatus;
}

export interface CreateDefectRequest {
  description: string;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

/** Bloco de métricas (PCs ou equipamentos): contagens por status. */
export interface KpiBlockDTO {
  totalDisponivel: number;
  totalEmUso: number;
  totalProvisorio: number;
  totalManutencao: number;
  totalBaixado: number;
  totalExcluido: number;
  totalInservivel: number;
  totalGeral: number;
}

export interface DashboardStatsDTO {
  kpiPcs: KpiBlockDTO;
  kpiEquipamentos: KpiBlockDTO;
}

export interface SectorMetricDTO {
  acronym: string;
  fullName: string;
  totalItens: number;
  distributionByType: Partial<Record<EquipmentType, number>>;
}

// ─── Paginação ───────────────────────────────────────────────────────────────

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface ErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  validationErrors?: Record<string, string>;
}
