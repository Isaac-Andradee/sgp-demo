import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  Monitor,
  Filter,
  X,
  Package,
} from "lucide-react";
import { auditApi } from "../api/audit.api";
import { equipmentApi } from "../api/equipment.api";
import { sectorApi } from "../api/sector.api";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_COLORS,
  EQUIPMENT_TYPE_LABELS,
  getEquipmentPrimaryIdentifier,
  getEquipmentTypeLabel,
} from "../types";
import type { AuditActionType, AuditLog, EquipmentResponseDTO, EquipmentType, SectorResponseDTO } from "../types";
import { usePageTitle } from "../hooks/usePageTitle";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

/** Patrimônio → serial → fallback legível (sem UUID). */
function getEquipmentDisplayName(eq: EquipmentResponseDTO | undefined): string {
  if (!eq) return "Equipamento indisponível";
  return getEquipmentPrimaryIdentifier(eq);
}

/** Resolve UUID na descrição: equipamento → patrimônio/série; setor → sigla. */
function resolveAuditUuid(
  id: string,
  equipmentMap: Map<string, EquipmentResponseDTO>,
  sectorMap: Map<string, SectorResponseDTO>,
): string {
  const eq = equipmentMap.get(id);
  if (eq) return getEquipmentDisplayName(eq);
  const sector = sectorMap.get(id);
  if (sector) return sector.acronym;
  return id;
}

const EQUIPMENT_TYPE_ENUM_RE = new RegExp(
  `\\b(${Object.keys(EQUIPMENT_TYPE_LABELS).join("|")})\\b`,
  "g",
);

/** Backend grava EquipmentType.name() (ex.: ARMAZENAMENTO); exibimos o label (Armazenamento). */
function humanizeEquipmentTypeEnums(text: string): string {
  return text.replace(EQUIPMENT_TYPE_ENUM_RE, (token) =>
    getEquipmentTypeLabel(token as EquipmentType),
  );
}

function trimOrphanHostnameSeparator(text: string): string {
  return text.replace(/\s+—\s*$/g, "").trim();
}

const EQUIPMENT_CREATE_DESC_RE = /^Equipamento cadastrado:\s*(.+)$/i;

/**
 * Cadastro no backend: tipo — hostname. Sem host, complementa com marca do equipamento.
 */
function enrichEquipmentCreateDescription(
  text: string,
  eq: EquipmentResponseDTO,
): string {
  const match = EQUIPMENT_CREATE_DESC_RE.exec(text.trim());
  if (!match) return text;

  const typeLabel = getEquipmentTypeLabel(eq.type);
  const brand = eq.brand?.trim();
  const rest = match[1].trim();
  const dashIdx = rest.indexOf(" — ");

  if (dashIdx >= 0) {
    const host = rest.slice(dashIdx + 3).trim();
    if (host && brand) {
      return `Equipamento cadastrado: ${typeLabel} · ${brand} — ${host}`;
    }
    if (!host && brand) {
      return `Equipamento cadastrado: ${typeLabel} · ${brand}`;
    }
    if (host) {
      return `Equipamento cadastrado: ${typeLabel} — ${host}`;
    }
    return `Equipamento cadastrado: ${typeLabel}`;
  }

  if (brand && rest !== `${typeLabel} · ${brand}`) {
    return `Equipamento cadastrado: ${typeLabel} · ${brand}`;
  }
  return `Equipamento cadastrado: ${typeLabel}`;
}

/** Troca UUIDs por patrimônio/série/sigla e omite campos cujo valor é null (ex.: hostname). */
function formatAuditDescription(
  text: string,
  equipmentMap: Map<string, EquipmentResponseDTO>,
  sectorMap: Map<string, SectorResponseDTO>,
  actionType?: AuditActionType,
  entityEquipment?: EquipmentResponseDTO,
): string {
  let s = text.replace(UUID_RE, (id) => resolveAuditUuid(id, equipmentMap, sectorMap));
  s = s.replace(/\b(hostname|host|ip(?:\s*address)?)\s*[:=]\s*null\b/gi, "");
  s = s.replace(/\([^)]*\bnull\b[^)]*\)/gi, "");
  s = s.replace(/\bnull\b/gi, "");
  s = humanizeEquipmentTypeEnums(s);
  s = trimOrphanHostnameSeparator(s);
  s = s
    .replace(/\s*[,;|·]\s*([,;|·]\s*)+/g, " · ")
    .replace(/^\s*[,;|·]\s*/g, "")
    .replace(/\s*[,;|·]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (actionType === "EQUIPMENT_CREATE" && entityEquipment) {
    s = enrichEquipmentCreateDescription(s, entityEquipment);
  }

  return s;
}

function isEquipmentAuditLog(log: AuditLog): boolean {
  return log.entityType === "Equipment" || log.actionType.startsWith("EQUIPMENT_");
}

function EquipmentBadge({ eq }: { eq: EquipmentResponseDTO | undefined }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mb-1.5">
      <Package className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 flex-shrink-0" />
      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
        {getEquipmentDisplayName(eq)}
      </span>
      {eq && (
        <span className="text-[11px] text-muted-foreground">
          · {EQUIPMENT_TYPE_LABELS[eq.type]} {eq.brand}
        </span>
      )}
    </div>
  );
}

function EntityFooter({ log }: { log: AuditLog }) {
  if (!log.entityId || isEquipmentAuditLog(log)) return null;
  return (
    <p className="text-[10px] text-muted-foreground mt-1.5">
      <span className="uppercase tracking-wide" style={{ fontWeight: 600 }}>
        {log.entityType}
      </span>
      {" · "}
      <span>{log.entityId}</span>
    </p>
  );
}

const ACTION_TYPE_OPTIONS: { value: AuditActionType | ""; label: string }[] = [
  { value: "",                   label: "Todos os eventos"          },
  { value: "LOGIN",              label: "Login"                     },
  { value: "LOGOUT",             label: "Logout"                    },
  { value: "EQUIPMENT_CREATE",   label: "Cadastro de Equipamento"   },
  { value: "EQUIPMENT_UPDATE",   label: "Atualização de Equipamento"},
  { value: "EQUIPMENT_DELETE",   label: "Exclusão de Equipamento"   },
  { value: "EQUIPMENT_SWAP",     label: "Substituição de Equipamento"},
  { value: "EQUIPMENT_TRANSFER", label: "Transferência de Equipamento"},
  { value: "USER_CREATE",        label: "Criação de Usuário"        },
  { value: "USER_UPDATE",        label: "Atualização de Usuário"    },
  { value: "USER_DELETE",        label: "Exclusão de Usuário"       },
];
const ACTION_TYPE_OPTIONS_SORTED = [...ACTION_TYPE_OPTIONS].sort((a, b) =>
  a.label === "Todos os eventos" ? -1 : b.label === "Todos os eventos" ? 1 : a.label.localeCompare(b.label)
);

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getRelativeLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  if (diffSec < 60)       return "agora mesmo";
  if (diffMin < 60)       return `há ${diffMin}min`;
  if (diffMin < 1440)     return `há ${Math.floor(diffMin / 60)}h`;
  return `há ${Math.floor(diffMin / 1440)}d`;
}

function RelativeTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState(() => getRelativeLabel(iso));

  useEffect(() => {
    const tick = () => setLabel(getRelativeLabel(iso));
    // Atualiza a cada 30s para manter o tempo relativo preciso
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [iso]);

  return (
    <span title={formatDate(iso)} className="text-muted-foreground text-[11px]">
      {label}
    </span>
  );
}

export function AuditoriaPage() {
  usePageTitle("Auditoria");
  const [page, setPage] = useState(0);
  const [actorSearch, setActorSearch] = useState("");
  const [actionType, setActionType] = useState<AuditActionType | "">("");

  const hasFilters = !!(actorSearch || actionType);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit", page, actorSearch, actionType],
    queryFn: () =>
      auditApi.list({
        page,
        size: 20,
        actorUsername: actorSearch || undefined,
        actionType:    actionType   || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  // Carrega todos os equipamentos uma vez para resolver entityId → patrimônio/serial.
  // Cache longo: o usuário do audit normalmente só consulta, não cria equipamentos.
  const { data: allEquipments } = useQuery({
    queryKey: ["equipments-all-for-audit"],
    queryFn: () => equipmentApi.filter({}),
    staleTime: 5 * 60_000,
  });

  const equipmentMap = useMemo(() => {
    const m = new Map<string, EquipmentResponseDTO>();
    (allEquipments ?? []).forEach((e) => m.set(e.id, e));
    return m;
  }, [allEquipments]);

  const { data: allSectors } = useQuery({
    queryKey: ["sectors-for-audit"],
    queryFn: sectorApi.list,
    staleTime: 5 * 60_000,
  });

  const sectorMap = useMemo(() => {
    const m = new Map<string, SectorResponseDTO>();
    (allSectors ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [allSectors]);

  const clearFilters = () => {
    setActorSearch("");
    setActionType("");
    setPage(0);
  };

  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="text-[18px] text-foreground" style={{ fontWeight: 700 }}>
              Log de Auditoria
            </h3>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Histórico completo de ações realizadas no sistema
          </p>
        </div>
        {totalElements > 0 && (
          <div className="shrink-0 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2 text-center">
            <p className="text-[20px] text-primary tabular-nums" style={{ fontWeight: 700 }}>
              {totalElements.toLocaleString("pt-BR")}
            </p>
            <p className="text-[10px] text-primary/60 uppercase tracking-wide" style={{ fontWeight: 600 }}>
              eventos totais
            </p>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-card rounded-xl border border-border shadow-sm mb-4">
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Busca por usuário */}
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                Filtrar por Usuário
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={actorSearch}
                  onChange={(e) => { setActorSearch(e.target.value); setPage(0); }}
                  type="text"
                  placeholder="Username do autor da ação..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all bg-background"
                />
              </div>
            </div>

            {/* Tipo de ação */}
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                Tipo de Evento
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  value={actionType}
                  onChange={(e) => { setActionType(e.target.value as AuditActionType | ""); setPage(0); }}
                  className="w-full pl-10 pr-8 py-2.5 rounded-lg border border-border focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all bg-background appearance-none"
                >
                  {ACTION_TYPE_OPTIONS_SORTED.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 flex items-center gap-1.5 text-[12px] text-sky-600 hover:text-sky-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
          )}
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Data/Hora", "Usuário", "Evento", "Descrição", "IP"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 md:px-5 py-3 text-left text-[11px] text-muted-foreground bg-muted/60 whitespace-nowrap ${
                      i === 3 ? "w-full" : ""
                    }`}
                    style={{ fontWeight: 700 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-muted rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <p className="text-[13px] text-rose-500">
                      Erro ao carregar o log de auditoria. Verifique sua conexão.
                    </p>
                  </td>
                </tr>
              ) : data?.content.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Search className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-[14px] text-muted-foreground" style={{ fontWeight: 500 }}>
                        {hasFilters ? "Nenhum evento encontrado com esses filtros" : "Nenhum evento registrado ainda"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.content.map((log) => {
                  // Fallback defensivo: um actionType novo no backend (ainda não
                  // mapeado aqui) degrada em cinza em vez de quebrar a página.
                  const colors = AUDIT_ACTION_COLORS[log.actionType] ?? {
                    bg: "bg-gray-50 dark:bg-gray-800",
                    text: "text-gray-600 dark:text-gray-400",
                    dot: "bg-gray-400 dark:bg-gray-500",
                  };
                  const actionLabel = AUDIT_ACTION_LABELS[log.actionType] ?? log.actionType;
                  const isEquipment = isEquipmentAuditLog(log);
                  const eq = isEquipment && log.entityId
                    ? equipmentMap.get(log.entityId)
                    : undefined;
                  const description = log.description
                    ? formatAuditDescription(
                        log.description,
                        equipmentMap,
                        sectorMap,
                        log.actionType,
                        eq,
                      )
                    : "";
                  return (
                    <tr key={log.id} className="hover:bg-muted/50 transition-colors duration-100">
                      {/* Data */}
                      <td className="px-4 md:px-5 py-3.5 whitespace-nowrap align-top">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                              {new Date(log.createdAt).toLocaleString("pt-BR", {
                                day: "2-digit", month: "2-digit",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <RelativeTime iso={log.createdAt} />
                        </div>
                      </td>

                      {/* Usuário */}
                      <td className="px-4 md:px-5 py-3.5 whitespace-nowrap align-top">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                            {log.actorUsername || <span className="text-muted-foreground italic">anônimo</span>}
                          </span>
                        </div>
                      </td>

                      {/* Tipo de evento */}
                      <td className="px-4 md:px-5 py-3.5 whitespace-nowrap align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] ${colors.bg} ${colors.text}`}
                          style={{ fontWeight: 600 }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          {actionLabel}
                        </span>
                      </td>

                      {/* Descrição */}
                      <td className="px-4 md:px-5 py-3.5 align-top">
                        <div className="min-w-[280px] max-w-[720px]">
                          {isEquipment && <EquipmentBadge eq={eq} />}
                          {description ? (
                            <p className="text-[12.5px] text-foreground whitespace-pre-wrap break-words leading-relaxed">
                              {description}
                            </p>
                          ) : !isEquipment ? (
                            <span className="text-muted-foreground">—</span>
                          ) : null}
                          <EntityFooter log={log} />
                        </div>
                      </td>

                      {/* IP */}
                      <td className="px-4 md:px-5 py-3.5 whitespace-nowrap align-top">
                        {log.ipAddress ? (
                          <div className="flex items-center gap-1.5">
                            <Monitor className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-[12px] text-muted-foreground font-mono">{log.ipAddress}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-border bg-muted/40 flex items-center justify-between gap-4">
            <p className="text-[12px] text-muted-foreground">
              Página <span style={{ fontWeight: 600 }} className="text-foreground">{page + 1}</span> de{" "}
              <span style={{ fontWeight: 600 }} className="text-foreground">{totalPages}</span>
              {" "}·{" "}
              <span style={{ fontWeight: 600 }} className="text-foreground">
                {totalElements.toLocaleString("pt-BR")}
              </span>{" "}
              eventos
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const pageNum = Math.max(0, Math.min(totalPages - 5, page - 2)) + i;
                const isActive = pageNum === page;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`min-w-[32px] h-8 rounded-lg text-[13px] transition-colors ${
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "border border-border text-muted-foreground hover:bg-muted"
                    }`}
                    style={{ fontWeight: isActive ? 700 : 400 }}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-2">
        Dados atualizados a cada vez que a página é carregada · Acesso restrito a administradores
      </p>
    </div>
  );
}
