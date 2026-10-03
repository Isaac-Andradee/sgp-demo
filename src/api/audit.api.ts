import { api } from "./client";
import { toDownload } from "./report.api";
import type { AuditActionType, AuditLog } from "../types";

/** Resposta paginada do backend (PagedResponse). */
export interface AuditPage {
  content: AuditLog[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export type AuditSortField = "createdAt" | "actorUsername" | "actionType" | "entityType" | "ipAddress";
export type SortDirection = "asc" | "desc";

export interface AuditFilters {
  page?: number;
  size?: number;
  sort?: AuditSortField;
  direction?: SortDirection;
  /** Datas ISO (AAAA-MM-DD), ambas inclusivas. */
  from?: string;
  to?: string;
  /** Trecho do username do autor. */
  actor?: string;
  actionTypes?: AuditActionType[];
  entityType?: string;
  /** Início do IP (ex.: "10.190." filtra a sub-rede). */
  ip?: string;
  /** Trecho da descrição ou id exato da entidade. */
  q?: string;
}

export interface AuditFilterOptions {
  actors: string[];
  entityTypes: string[];
}

export function buildAuditParams(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(filters.page ?? 0));
  params.set("size", String(filters.size ?? 20));
  params.set("sort", filters.sort ?? "createdAt");
  params.set("direction", filters.direction ?? "desc");
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.actor?.trim()) params.set("actor", filters.actor.trim());
  filters.actionTypes?.forEach((t) => params.append("actionTypes", t));
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.ip?.trim()) params.set("ip", filters.ip.trim());
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  return params;
}

/** Limites do backend por formato (AuditReportService): acima disso ele recusa com 400. */
export const AUDIT_REPORT_MAX_ROWS = { pdf: 5_000, csv: 100_000 } as const;
export type AuditReportFormat = keyof typeof AUDIT_REPORT_MAX_ROWS;

export const auditApi = {
  list: (filters: AuditFilters = {}): Promise<AuditPage> =>
    api.get<AuditPage>(`/audit?${buildAuditParams(filters).toString()}`).then((r) => r.data),

  filterOptions: (): Promise<AuditFilterOptions> =>
    api.get<AuditFilterOptions>("/audit/filter-options").then((r) => r.data),

  /** Baixa o relatório (PDF ou CSV) com os mesmos filtros e ordenação da consulta — sem paginação. */
  report: async (format: AuditReportFormat, filters: AuditFilters): Promise<{ blob: Blob; filename: string }> => {
    const params = buildAuditParams(filters);
    params.delete("page");
    params.delete("size");
    const res = await api.get(`/audit/report/${format}`, { params, responseType: "blob" });
    return toDownload(res, `auditoria-sgpt-${new Date().toISOString().slice(0, 10)}.${format}`);
  },
};
