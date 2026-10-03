import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import {
  Shield,
  Search,
  User,
  Clock,
  Monitor,
  Filter,
  X,
  Package,
  CalendarDays,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Box,
  FileText,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { auditApi, AUDIT_REPORT_MAX_ROWS } from "../api/audit.api";
import type { AuditFilters, AuditReportFormat, AuditSortField, SortDirection } from "../api/audit.api";
import { blobErrorMessage, downloadBlob } from "../api/report.api";
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
import { DataPagination } from "./data-pagination";
import { PERIOD_OPTIONS, resolvePeriod } from "./audit-period";
import type { PeriodKey } from "./audit-period";

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

// ─── Filtros ─────────────────────────────────────────────────────────────────

/** Tipos de evento agrupados para o seletor múltiplo. */
const ACTION_TYPE_GROUPS: { label: string; types: AuditActionType[] }[] = [
  {
    label: "Equipamentos",
    types: ["EQUIPMENT_CREATE", "EQUIPMENT_UPDATE", "EQUIPMENT_TRANSFER", "EQUIPMENT_SWAP", "EQUIPMENT_DELETE"],
  },
  { label: "Acesso", types: ["LOGIN", "LOGOUT", "PASSWORD_RECOVERED_WITH_CODE"] },
  {
    label: "Usuários",
    types: ["USER_CREATE", "USER_UPDATE", "USER_DELETE", "USER_PASSWORD_RESET", "USER_RECOVERY_CODE_GENERATED"],
  },
  {
    label: "Sistema",
    types: ["REPORT_GENERATED", "MAINTENANCE_ENABLED", "MAINTENANCE_DISABLED", "MAINTENANCE_SETTINGS_UPDATED", "ANNOUNCEMENT_UPDATED"],
  },
];
const ALL_ACTION_TYPES = new Set<string>(ACTION_TYPE_GROUPS.flatMap((g) => g.types));

/** Nomes técnicos de entidade gravados pelo backend → rótulo em português. */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  Equipment: "Equipamento",
  EquipmentSheet: "Ficha de equipamento",
  User: "Usuário",
  Report: "Relatório",
  System: "Sistema",
  Sector: "Setor",
};
const entityLabel = (t: string) => ENTITY_TYPE_LABELS[t] ?? t;

const formatBrDate = (iso: string) => iso.split("-").reverse().join("/");

const SORT_FIELDS: AuditSortField[] = ["createdAt", "actorUsername", "actionType", "entityType", "ipAddress"];
const PAGE_SIZES = [20, 50, 100];
const TEXT_DEBOUNCE_MS = 400;

const inputClass =
  "w-full py-2.5 rounded-lg border border-border focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all bg-background";
const labelClass = "block text-[11px] text-muted-foreground mb-1";

/** Lê o estado da consulta da URL — a URL é a fonte da verdade (link compartilhável, voltar do navegador). */
function readFilters(params: URLSearchParams) {
  const period = (params.get("period") ?? "") as PeriodKey;
  const size = Number(params.get("size"));
  const sort = params.get("sort") as AuditSortField | null;
  return {
    page: Math.max(0, (Number.parseInt(params.get("page") ?? "1", 10) || 1) - 1),
    size: PAGE_SIZES.includes(size) ? size : 20,
    sort: sort && SORT_FIELDS.includes(sort) ? sort : "createdAt",
    direction: (params.get("dir") === "asc" ? "asc" : "desc") as SortDirection,
    period,
    customFrom: params.get("from") ?? "",
    customTo: params.get("to") ?? "",
    actor: params.get("actor") ?? "",
    actionTypes: (params.get("types") ?? "").split(",").filter((t) => ALL_ACTION_TYPES.has(t)) as AuditActionType[],
    entityType: params.get("entity") ?? "",
    ip: params.get("ip") ?? "",
    q: params.get("q") ?? "",
  };
}

/** Campo de texto que só publica o valor após uma pausa na digitação (evita 1 consulta por tecla). */
function DebouncedInput({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // Valor externo mudou (ex.: "Limpar filtros", voltar do navegador): o rascunho acompanha.
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const id = setTimeout(() => onCommit(draft), TEXT_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft, value, onCommit]);

  return <input {...rest} value={draft} onChange={(e) => setDraft(e.target.value)} />;
}

function ActionTypeSelect({
  selected,
  onChange,
}: {
  selected: AuditActionType[];
  onChange: (types: AuditActionType[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (t: AuditActionType) =>
    onChange(selected.includes(t) ? selected.filter((s) => s !== t) : [...selected, t]);

  const toggleGroup = (types: AuditActionType[]) => {
    const allOn = types.every((t) => selected.includes(t));
    onChange(allOn ? selected.filter((t) => !types.includes(t)) : [...new Set([...selected, ...types])]);
  };

  const summary =
    selected.length === 0
      ? "Todos os eventos"
      : selected.length === 1
        ? AUDIT_ACTION_LABELS[selected[0]]
        : `${selected.length} tipos de evento`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Tipos de evento"
        className={`${inputClass} pl-10 pr-8 text-left relative`}
      >
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <span className={`block truncate ${selected.length ? "text-foreground" : "text-muted-foreground"}`}>{summary}</span>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-20 mt-1 w-full min-w-[260px] max-h-80 overflow-y-auto rounded-lg border border-border bg-popover dark:bg-card shadow-lg p-1.5"
        >
          {ACTION_TYPE_GROUPS.map((group) => {
            const allOn = group.types.every((t) => selected.includes(t));
            return (
              <div key={group.label} className="mb-1 last:mb-0">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.types)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                  style={{ fontWeight: 700 }}
                >
                  {group.label}
                  <span className="normal-case tracking-normal text-sky-600 dark:text-sky-400" style={{ fontWeight: 500 }}>
                    {allOn ? "desmarcar" : "marcar todos"}
                  </span>
                </button>
                {group.types.map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-foreground hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(t)}
                      onChange={() => toggle(t)}
                      className="accent-sky-600"
                    />
                    {AUDIT_ACTION_LABELS[t]}
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  field,
  sort,
  direction,
  onSort,
}: {
  label: string;
  field: AuditSortField;
  sort: AuditSortField;
  direction: SortDirection;
  onSort: (field: AuditSortField) => void;
}) {
  const active = sort === field;
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className="px-4 md:px-5 py-3 text-left text-[11px] text-muted-foreground bg-muted/60 whitespace-nowrap"
      style={{ fontWeight: 700 }}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
      >
        {label}
        <Icon className={`w-3 h-3 ${active ? "" : "opacity-40"}`} />
      </button>
    </th>
  );
}

/** Exporta exatamente o resultado da consulta atual (filtros + ordenação), sem paginação. */
function ExportButtons({ query, total, disabled }: { query: AuditFilters; total: number; disabled: boolean }) {
  const [generating, setGenerating] = useState<AuditReportFormat | null>(null);

  const generate = async (format: AuditReportFormat) => {
    setGenerating(format);
    try {
      const { blob, filename } = await auditApi.report(format, query);
      downloadBlob(blob, filename);
      toast.success(`Relatório gerado com ${total.toLocaleString("pt-BR")} evento(s).`);
    } catch (error) {
      toast.error((await blobErrorMessage(error)) ?? "Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setGenerating(null);
    }
  };

  const formats: { format: AuditReportFormat; label: string; Icon: typeof FileText }[] = [
    { format: "pdf", label: "PDF", Icon: FileText },
    { format: "csv", label: "CSV", Icon: FileSpreadsheet },
  ];

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Exportar resultado">
      {formats.map(({ format, label, Icon }) => {
        const max = AUDIT_REPORT_MAX_ROWS[format];
        const overLimit = total > max;
        const title = overLimit
          ? `O ${label} comporta até ${max.toLocaleString("pt-BR")} eventos; refine os filtros${format === "pdf" ? " ou use o CSV" : ""}.`
          : `Exportar os ${total.toLocaleString("pt-BR")} evento(s) filtrados em ${label}`;
        return (
          <button
            key={format}
            type="button"
            onClick={() => generate(format)}
            disabled={disabled || overLimit || generating !== null}
            title={title}
            aria-label={`Exportar ${label}`}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card text-[12.5px] text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ fontWeight: 600 }}
          >
            {generating === format
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Icon className="w-4 h-4 text-primary" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-[11.5px] text-sky-800 dark:text-sky-200">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro ${label}`}
        className="p-0.5 rounded-full hover:bg-sky-100 dark:hover:bg-sky-900"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const f = readFilters(searchParams);

  /** Atualiza parâmetros da URL; qualquer mudança de filtro volta para a 1ª página. */
  const update = (changes: Record<string, string | null>, keepPage = false) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (!keepPage) next.delete("page");
      return next;
    }, { replace: true });
  };
  // Estável entre renders para o debounce não reiniciar a cada atualização.
  const updateRef = useRef(update);
  useEffect(() => { updateRef.current = update; });
  const commitText = useMemo(
    () => ({
      actor: (v: string) => updateRef.current({ actor: v }),
      ip: (v: string) => updateRef.current({ ip: v }),
      q: (v: string) => updateRef.current({ q: v }),
    }),
    [],
  );

  const { from, to } =
    f.period === "custom" ? { from: f.customFrom || undefined, to: f.customTo || undefined } : resolvePeriod(f.period);
  const invalidRange = !!(from && to && from > to);

  const query: AuditFilters = {
    page: f.page,
    size: f.size,
    sort: f.sort,
    direction: f.direction,
    from,
    to,
    actor: f.actor || undefined,
    actionTypes: f.actionTypes.length ? f.actionTypes : undefined,
    entityType: f.entityType || undefined,
    ip: f.ip || undefined,
    q: f.q || undefined,
  };

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["audit", query],
    queryFn: () => auditApi.list(query),
    placeholderData: (prev) => prev,
    enabled: !invalidRange,
  });

  const { data: filterOptions } = useQuery({
    queryKey: ["audit-filter-options"],
    queryFn: auditApi.filterOptions,
    staleTime: 5 * 60_000,
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

  // Página além do fim (ex.: link antigo, filtro que reduziu o total): volta para a última existente.
  const totalPages = data?.totalPages ?? 0;
  useEffect(() => {
    if (data && totalPages > 0 && f.page > totalPages - 1) {
      updateRef.current({ page: String(totalPages) }, true);
    }
  }, [data, totalPages, f.page]);

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (f.period && f.period !== "custom") {
    chips.push({
      key: "period",
      label: PERIOD_OPTIONS.find((o) => o.value === f.period)?.label ?? f.period,
      remove: () => update({ period: null }),
    });
  }
  if (f.period === "custom" && (from || to)) {
    chips.push({
      key: "custom",
      label: from && to ? `${formatBrDate(from)} a ${formatBrDate(to)}` : from ? `Desde ${formatBrDate(from)}` : `Até ${formatBrDate(to!)}`,
      remove: () => update({ period: null, from: null, to: null }),
    });
  }
  if (f.actor) chips.push({ key: "actor", label: `Usuário: ${f.actor}`, remove: () => update({ actor: null }) });
  f.actionTypes.forEach((t) =>
    chips.push({
      key: `type-${t}`,
      label: AUDIT_ACTION_LABELS[t],
      remove: () => update({ types: f.actionTypes.filter((x) => x !== t).join(",") }),
    }),
  );
  if (f.entityType) chips.push({ key: "entity", label: `Entidade: ${entityLabel(f.entityType)}`, remove: () => update({ entity: null }) });
  if (f.ip) chips.push({ key: "ip", label: `IP: ${f.ip}`, remove: () => update({ ip: null }) });
  if (f.q) chips.push({ key: "q", label: `Texto: "${f.q}"`, remove: () => update({ q: null }) });

  const hasFilters = chips.length > 0;
  const clearFilters = () =>
    update({ period: null, from: null, to: null, actor: null, types: null, entity: null, ip: null, q: null });

  const onSort = (field: AuditSortField) => {
    // Mesma coluna inverte; coluna nova começa decrescente para data e crescente para texto.
    const direction: SortDirection =
      f.sort === field ? (f.direction === "asc" ? "desc" : "asc") : field === "createdAt" ? "desc" : "asc";
    update({ sort: field === "createdAt" ? null : field, dir: direction === "desc" ? null : direction });
  };

  const totalElements = data?.totalElements ?? 0;
  const entityTypes = filterOptions?.entityTypes ?? [];

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
        <div className="flex items-center gap-3 shrink-0">
          <ExportButtons
            query={query}
            total={totalElements}
            disabled={!data || invalidRange || isFetching}
          />
          {data && !invalidRange && (
            <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-2 text-center">
              <p className="text-[20px] text-primary tabular-nums" style={{ fontWeight: 700 }}>
                {totalElements.toLocaleString("pt-BR")}
              </p>
              <p className="text-[10px] text-primary/60 uppercase tracking-wide" style={{ fontWeight: 600 }}>
                {hasFilters ? "eventos encontrados" : "eventos totais"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card rounded-xl border border-border shadow-sm mb-4">
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {/* Período */}
            <div>
              <label htmlFor="audit-period" className={labelClass} style={{ fontWeight: 600 }}>Período</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  id="audit-period"
                  value={f.period}
                  onChange={(e) => {
                    const value = e.target.value as PeriodKey;
                    // Ao abrir o personalizado, já preenche com o período que estava em uso.
                    const current = value === "custom" ? resolvePeriod(f.period) : {};
                    update({ period: value || null, from: current.from ?? null, to: current.to ?? null });
                  }}
                  className={`${inputClass} pl-10 pr-8 appearance-none`}
                >
                  {PERIOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {f.period === "custom" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-muted-foreground">
                    De
                    <input
                      type="date"
                      value={f.customFrom}
                      max={f.customTo || undefined}
                      onChange={(e) => update({ from: e.target.value })}
                      className={`${inputClass} px-3 mt-0.5`}
                    />
                  </label>
                  <label className="text-[11px] text-muted-foreground">
                    Até
                    <input
                      type="date"
                      value={f.customTo}
                      min={f.customFrom || undefined}
                      onChange={(e) => update({ to: e.target.value })}
                      className={`${inputClass} px-3 mt-0.5`}
                    />
                  </label>
                  {invalidRange && (
                    <p role="alert" className="col-span-2 text-[11px] text-rose-500">
                      A data inicial não pode ser posterior à final.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Tipos de evento */}
            <div>
              <span className={labelClass} style={{ fontWeight: 600 }}>Tipo de Evento</span>
              <ActionTypeSelect
                selected={f.actionTypes}
                onChange={(types) => update({ types: types.join(",") })}
              />
            </div>

            {/* Usuário */}
            <div>
              <label htmlFor="audit-actor" className={labelClass} style={{ fontWeight: 600 }}>Usuário</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <DebouncedInput
                  id="audit-actor"
                  value={f.actor}
                  onCommit={commitText.actor}
                  type="text"
                  list="audit-actor-options"
                  autoComplete="off"
                  placeholder="Username do autor da ação..."
                  className={`${inputClass} pl-10 pr-4`}
                />
                <datalist id="audit-actor-options">
                  {(filterOptions?.actors ?? []).map((a) => <option key={a} value={a} />)}
                </datalist>
              </div>
            </div>

            {/* Entidade */}
            <div>
              <label htmlFor="audit-entity" className={labelClass} style={{ fontWeight: 600 }}>Entidade</label>
              <div className="relative">
                <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  id="audit-entity"
                  value={f.entityType}
                  onChange={(e) => update({ entity: e.target.value })}
                  className={`${inputClass} pl-10 pr-8 appearance-none`}
                >
                  <option value="">Todas as entidades</option>
                  {/* Mantém a opção da URL mesmo que ainda não tenha vindo nas opções. */}
                  {[...new Set([...entityTypes, ...(f.entityType ? [f.entityType] : [])])]
                    .sort((a, b) => entityLabel(a).localeCompare(entityLabel(b)))
                    .map((t) => (
                      <option key={t} value={t}>{entityLabel(t)}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* IP */}
            <div>
              <label htmlFor="audit-ip" className={labelClass} style={{ fontWeight: 600 }}>Endereço IP</label>
              <div className="relative">
                <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <DebouncedInput
                  id="audit-ip"
                  value={f.ip}
                  onCommit={commitText.ip}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Ex.: 10.190.110 (início do IP)"
                  className={`${inputClass} pl-10 pr-4 font-mono`}
                />
              </div>
            </div>

            {/* Texto livre */}
            <div>
              <label htmlFor="audit-q" className={labelClass} style={{ fontWeight: 600 }}>Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <DebouncedInput
                  id="audit-q"
                  value={f.q}
                  onCommit={commitText.q}
                  type="search"
                  autoComplete="off"
                  placeholder="Texto da descrição ou ID da entidade"
                  className={`${inputClass} pl-10 pr-4`}
                />
              </div>
            </div>
          </div>

          {hasFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <FilterChip key={c.key} label={c.label} onRemove={c.remove} />
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="ml-1 flex items-center gap-1.5 text-[12px] text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* Tabela */}
        <div className={`overflow-x-auto transition-opacity ${isFetching && !isLoading ? "opacity-60" : ""}`}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <SortableHeader label="Data/Hora" field="createdAt" sort={f.sort} direction={f.direction} onSort={onSort} />
                <SortableHeader label="Usuário" field="actorUsername" sort={f.sort} direction={f.direction} onSort={onSort} />
                <SortableHeader label="Evento" field="actionType" sort={f.sort} direction={f.direction} onSort={onSort} />
                <th
                  className="px-4 md:px-5 py-3 text-left text-[11px] text-muted-foreground bg-muted/60 whitespace-nowrap w-full"
                  style={{ fontWeight: 700 }}
                >
                  Descrição
                </th>
                <SortableHeader label="IP" field="ipAddress" sort={f.sort} direction={f.direction} onSort={onSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invalidRange ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[13px] text-muted-foreground">
                    Ajuste o período para consultar.
                  </td>
                </tr>
              ) : isLoading ? (
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
                                day: "2-digit", month: "2-digit", year: "2-digit",
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

        {!invalidRange && data && (
          <DataPagination
            page={Math.min(f.page, Math.max(0, totalPages - 1))}
            totalPages={totalPages}
            totalElements={totalElements}
            size={f.size}
            sizeOptions={PAGE_SIZES}
            itemLabel="eventos"
            onPageChange={(p) => update({ page: p === 0 ? null : String(p + 1) }, true)}
            onSizeChange={(s) => update({ size: s === 20 ? null : String(s) })}
          />
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-2">
        Os filtros ficam no endereço da página — copie o link para compartilhar a consulta · Acesso restrito a administradores
      </p>
    </div>
  );
}
