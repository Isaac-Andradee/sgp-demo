import { api } from "./client";

/** Aviso programado exibido no banner do topo (quando ativo). */
export interface SystemAnnouncement {
  message: string;
  scheduledAt: string | null;
}

/**
 * Status público do sistema (`GET /system/status`). Endpoint aberto e liberado
 * mesmo durante a manutenção — alimenta o banner de aviso e a tela de manutenção
 * em tempo real, substituindo as antigas variáveis `VITE_MAINTENANCE_*`.
 */
export interface SystemStatus {
  maintenance: boolean;
  maintenanceMessage: string;
  maintenanceWindowStart: string | null;
  maintenanceExpectedReturn: string | null;
  announcement: SystemAnnouncement | null;
}

export const systemApi = {
  getStatus: (): Promise<SystemStatus> =>
    api.get<SystemStatus>("/system/status").then((r) => r.data),
};
