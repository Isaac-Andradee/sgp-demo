import { api } from "./client";
import type { AuditLog } from "../types";

export interface AuditPage {
  content: AuditLog[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface AuditFilters {
  page?: number;
  size?: number;
  actorUsername?: string;
  actionType?: string;
}

export const auditApi = {
  list: (filters: AuditFilters = {}): Promise<AuditPage> => {
    const params = new URLSearchParams();
    params.set("page", String(filters.page ?? 0));
    params.set("size", String(filters.size ?? 20));
    params.set("sort", "createdAt,desc");
    if (filters.actorUsername) params.set("actorUsername", filters.actorUsername);
    if (filters.actionType)    params.set("actionType", filters.actionType);
    return api.get<AuditPage>(`/audit?${params.toString()}`).then((r) => r.data);
  },
};
