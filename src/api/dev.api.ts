import { api } from "./client";

export interface MaintenanceStatus {
  active: boolean;
}

/** Informações do ambiente do backend (`GET /dev/system/info`). */
export interface SystemInfo {
  javaVersion?: string;
  javaVendor?: string;
  springVersion?: string;
  osName?: string;
  maintenanceActive?: boolean;
  environment?: string;
}

/** Estado bruto das configurações de manutenção/comunicação (`GET /dev/settings`). */
export interface SystemSettings {
  maintenanceMessage: string | null;
  maintenanceWindowStart: string | null;
  maintenanceExpectedReturn: string | null;
  announcementEnabled: boolean;
  announcementMessage: string | null;
  announcementScheduledAt: string | null;
}

export interface UpdateMaintenanceSettingsPayload {
  message?: string;
  windowStart?: string;
  expectedReturn?: string;
}

export interface UpdateAnnouncementPayload {
  enabled: boolean;
  message?: string;
  scheduledAt?: string;
}

export const devApi = {
  /** Obtém o status atual do modo manutenção */
  getMaintenanceStatus: (): Promise<MaintenanceStatus> =>
    api.get<MaintenanceStatus>("/dev/maintenance/status").then((r) => r.data),

  /** Ativa o modo manutenção */
  enableMaintenance: (): Promise<{ message: string }> =>
    api.post<{ message: string }>("/dev/maintenance/enable").then((r) => r.data),

  /** Desativa o modo manutenção */
  disableMaintenance: (): Promise<{ message: string }> =>
    api.post<{ message: string }>("/dev/maintenance/disable").then((r) => r.data),

  /** Informações do ambiente do backend */
  getSystemInfo: (): Promise<SystemInfo> =>
    api.get<SystemInfo>("/dev/system/info").then((r) => r.data),

  /** Configurações brutas (para o formulário da Central de Manutenção) */
  getSettings: (): Promise<SystemSettings> =>
    api.get<SystemSettings>("/dev/settings").then((r) => r.data),

  /** Personaliza a tela de manutenção (mensagem, janela e previsão de retorno) */
  updateMaintenanceSettings: (payload: UpdateMaintenanceSettingsPayload): Promise<{ message: string }> =>
    api.put<{ message: string }>("/dev/maintenance-settings", payload).then((r) => r.data),

  /** Publica/atualiza o aviso programado exibido aos usuários */
  updateAnnouncement: (payload: UpdateAnnouncementPayload): Promise<{ message: string }> =>
    api.put<{ message: string }>("/dev/announcement", payload).then((r) => r.data),
};
