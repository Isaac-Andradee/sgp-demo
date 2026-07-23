import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Users,
  Wrench,
  AlertTriangle,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Monitor,
  Laptop,
  Printer,
  Server,
  Wifi,
  HardDrive,
  Mouse,
  Keyboard,
  ChevronDown,
  Filter,
  Archive,
  Zap,
  Box,
  Tag,
} from "lucide-react";
import { equipmentApi } from "../api/equipment.api";
import { sectorApi } from "../api/sector.api";
import type { EquipmentResponseDTO, EquipmentType, EquipmentStatus, EquipmentFilterDTO, SectorMetricDTO } from "../types";
import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_STATUS_COLORS,
  normalizeEquipmentStatus,
  getEquipmentTypeLabel,
  isEquipmentWithoutAsset,
} from "../types";
import { EquipmentModal } from "./equipment-modal";
import { EquipmentDetailsModal } from "./equipment-details-modal";
import { ConfirmDialog } from "./confirm-dialog";
import { usePermissions } from "../contexts/AuthContext";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 10;

function getTypeIcon(tipo: EquipmentType) {
  switch (tipo) {
    case "PC": return Monitor;
    case "NOTEBOOK": return Laptop;
    case "IMPRESSORA": return Printer;
    case "SERVIDOR": return Server;
    case "SWITCH": return Wifi;
    case "ROTEADOR": return Wifi;
    case "MONITOR": return Monitor;
    case "MOUSE": return Mouse;
    case "TECLADO": return Keyboard;
    case "ESTABILIZADOR": return Zap;
    case "NOBREAK": return Zap;
    case "ROTULADORA": return Tag;
    case "ARMAZENAMENTO": return HardDrive;
    case "OUTROS": return Box;
    default: return HardDrive;
  }
}

const EQUIPMENT_STATUS_TOOLTIPS: Record<EquipmentStatus, string> = {
  DISPONIVEL: "Disponível — não alocado, pronto para uso",
  INSERVIVEL: "Inservível — aguardando destinação ou descarte",
  PROVISORIO: "Provisório — sem etiqueta patrimonial, pendente de regularização",
  EM_USO: "Em Uso — alocado a um usuário ou setor",
  MANUTENCAO: "Em Manutenção — enviado para reparo",
  BAIXADO: "Baixado — descartado definitivamente do patrimônio",
  EXCLUIDO: "Excluído — oculto da tabela geral, mantido apenas para histórico",
};

const DEFAULT_STATUS_STYLE = { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700" };

function StatusBadge({ status }: { status: EquipmentStatus | string | undefined }) {
  const safeStatus = normalizeEquipmentStatus(status) ?? (status && (status as EquipmentStatus) in EQUIPMENT_STATUS_COLORS ? (status as EquipmentStatus) : null);
  const colors = safeStatus ? EQUIPMENT_STATUS_COLORS[safeStatus] : DEFAULT_STATUS_STYLE;
  const label = safeStatus ? EQUIPMENT_STATUS_LABELS[safeStatus] : (status ?? "—");
  const title = safeStatus ? EQUIPMENT_STATUS_TOOLTIPS[safeStatus] : String(status ?? "");
  return (
    <span
      title={title}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border ${colors.bg} ${colors.text} ${colors.border}`}
      style={{ fontWeight: 600 }}
    >
      {label}
    </span>
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { canCreateEquipment, canEditEquipment, canDeleteEquipment, isAdmin } = usePermissions();

  const [selectedSector, setSelectedSector] = useState<SectorMetricDTO | null>(null);
  const [search, setSearch] = useState("");
  const [filterSetorId, setFilterSetorId] = useState("");
  const [filterTipo, setFilterTipo] = useState<EquipmentType | "">("");
  const [filterStatus, setFilterStatus] = useState<EquipmentStatus | "">("");
  const [filterStatusSource, setFilterStatusSource] = useState<"pcs" | "equipamentos" | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const tableSectionRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentResponseDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentResponseDTO | null>(null);
  const [viewingEquipment, setViewingEquipment] = useState<EquipmentResponseDTO | null>(null);

  // Queries
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["kpis"],
    queryFn: equipmentApi.getKpis,
    staleTime: 30_000,
  });

  const { data: sectorStats } = useQuery({
    queryKey: ["sector-stats"],
    queryFn: equipmentApi.getSectorStats,
    staleTime: 30_000,
  });

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: sectorApi.list,
    staleTime: 60_000,
  });

  const hasFilters = !!(search || filterSetorId || filterTipo || filterStatus || filterStatusSource === "pcs");

  const filterBody: EquipmentFilterDTO = {
    ...(search ? { textoBusca: search } : {}),
    ...(filterSetorId ? { setorId: filterSetorId } : {}),
    ...(filterStatusSource === "pcs" ? { tipo: "PC" } : filterTipo ? { tipo: filterTipo } : {}),
    ...(filterStatus ? { status: filterStatus } : {}),
  };

  const { data: filteredList, isLoading: filteredLoading } = useQuery({
    queryKey: ["equipments-filter", filterBody],
    queryFn: () => equipmentApi.filter(filterBody),
    enabled: hasFilters,
    staleTime: 15_000,
  });

  const { data: pagedData, isLoading: pagedLoading } = useQuery({
    queryKey: ["equipments-paged", currentPage],
    queryFn: () => equipmentApi.list(currentPage, ITEMS_PER_PAGE),
    enabled: !hasFilters,
    staleTime: 15_000,
  });

  // Marcar como EXCLUIDO (some da listagem geral; ADMIN/DEV podem ver no card Excluídos)
  const excludeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof equipmentApi.update>[1] }) =>
      equipmentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipments"] });
      queryClient.invalidateQueries({ queryKey: ["equipments-paged"] });
      queryClient.invalidateQueries({ queryKey: ["equipments-filter"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
      queryClient.invalidateQueries({ queryKey: ["sector-stats"] });
      toast.success("Equipamento marcado como excluído e removido da listagem geral.");
    },
    onError: () => toast.error("Erro ao marcar equipamento como excluído."),
  });

  const handleDelete = (equip: EquipmentResponseDTO) => {
    setDeleteTarget(equip);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const payload = {
      assetNumber: deleteTarget.assetNumber,
      serialNumber: deleteTarget.serialNumber ?? undefined,
      description: deleteTarget.description ?? undefined,
      hostname: deleteTarget.hostname ?? undefined,
      ipAddress: deleteTarget.ipAddress ?? undefined,
      brand: deleteTarget.brand,
      type: deleteTarget.type,
      status: "EXCLUIDO" as const,
      equipmentUser: undefined,
      sectorId: deleteTarget.currentSector.id,
    };
    excludeMutation.mutate({ id: deleteTarget.id, data: payload }, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  const handleEdit = (equip: EquipmentResponseDTO) => {
    setEditingEquipment(equip);
    setModalOpen(true);
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["equipments-paged"] });
    queryClient.invalidateQueries({ queryKey: ["equipments-filter"] });
    queryClient.invalidateQueries({ queryKey: ["kpis"] });
    queryClient.invalidateQueries({ queryKey: ["sector-stats"] });
    setModalOpen(false);
    setEditingEquipment(null);
  };

  const clearFilters = () => {
    setSearch("");
    setFilterSetorId("");
    setFilterTipo("");
    setFilterStatus("");
    setFilterStatusSource(null);
    setCurrentPage(0);
    setSelectedSector(null);
  };

  // Ao clicar em um card de setor: seleciona e filtra a tabela por sigla do setor
  const handleSectorClick = (sector: SectorMetricDTO) => {
    if (selectedSector?.acronym === sector.acronym) {
      // Deseleciona se clicar no mesmo
      setSelectedSector(null);
      setFilterSetorId("");
      setFilterTipo("");
    } else {
      setSelectedSector(sector);
      // Encontra o setor pelo acrônimo para pegar o ID
      const found = sectors?.find((s) => s.acronym === sector.acronym);
      setFilterSetorId(found?.id ?? "");
      setFilterTipo("");
      setCurrentPage(0);
    }
  };

  // Ao clicar em um tipo no breakdown: filtra por setor + tipo
  const handleTypeClick = (tipo: EquipmentType) => {
    setFilterStatusSource(null);
    if (filterTipo === tipo) {
      setFilterTipo("");
    } else {
      setFilterTipo(tipo);
      setCurrentPage(0);
    }
  };

  // Data to render
  const isLoading = hasFilters ? filteredLoading : pagedLoading;

  // Equipamentos com defeito em aberto têm prioridade de visualização (vem primeiro na lista)
  // Dentro de cada grupo (com/sem defeito), ordenar dos mais recentes para os mais antigos (createdAt DESC)
  const prioritizeDefects = (list: EquipmentResponseDTO[] = []) =>
    [...list].sort((a, b) => {
      const aHas = !!a.hasOpenDefect;
      const bHas = !!b.hasOpenDefect;
      if (aHas !== bHas) return aHas ? -1 : 1;
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

  const baseList: EquipmentResponseDTO[] = hasFilters
    ? (filteredList ?? [])
    : (pagedData?.content ?? []);

  const sortedList = prioritizeDefects(baseList);

  const displayItems: EquipmentResponseDTO[] = hasFilters
    ? sortedList.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE)
    : sortedList;

  const totalElements = hasFilters
    ? (filteredList?.length ?? 0)
    : (pagedData?.totalElements ?? 0);

  const totalPages = hasFilters
    ? Math.ceil((filteredList?.length ?? 0) / ITEMS_PER_PAGE)
    : (pagedData?.totalPages ?? 0);

  const kpiPcsTotalCard = { label: "Total de PCs", value: kpis?.kpiPcs?.totalGeral ?? "-", icon: Monitor, color: "text-primary", bg: "bg-sky-50 dark:bg-sky-950/50", border: "border-primary" };
  const kpiPcsCards = [
    { label: "PCs Disponiveis", value: kpis?.kpiPcs?.totalDisponivel ?? "-", icon: Package, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50", border: "border-emerald-500", status: "DISPONIVEL" as EquipmentStatus },
    { label: "PCs em Uso", value: kpis?.kpiPcs?.totalEmUso ?? "-", icon: Users, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/50", border: "border-sky-500", status: "EM_USO" as EquipmentStatus },
    { label: "PCs Manutencao", value: kpis?.kpiPcs?.totalManutencao ?? "-", icon: Wrench, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-500", status: "MANUTENCAO" as EquipmentStatus },
    { label: "PCs Provisorios", value: kpis?.kpiPcs?.totalProvisorio ?? "-", icon: AlertTriangle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/50", border: "border-rose-500", status: "PROVISORIO" as EquipmentStatus },
    { label: "PCs Baixado", value: kpis?.kpiPcs?.totalBaixado ?? "-", icon: Archive, color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-50 dark:bg-gray-800", border: "border-gray-400 dark:border-gray-600", status: "BAIXADO" as EquipmentStatus },
    ...(isAdmin ? [{ label: "PCs Excluidos", value: kpis?.kpiPcs?.totalExcluido ?? "-", icon: Archive, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800", border: "border-slate-500", status: "EXCLUIDO" as EquipmentStatus }] : []),
    { label: "PCs Inserviveis", value: kpis?.kpiPcs?.totalInservivel ?? "-", icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/50", border: "border-red-500", status: "INSERVIVEL" as EquipmentStatus },
  ];

  const kpiEquipamentosTotalCard = { label: "Total de Equipamentos", value: kpis?.kpiEquipamentos?.totalGeral ?? "-", icon: Package, color: "text-primary", bg: "bg-sky-50 dark:bg-sky-950/50", border: "border-primary" };
  const kpiEquipamentosCards = [
    { label: "Disponiveis", value: kpis?.kpiEquipamentos?.totalDisponivel ?? "-", icon: Package, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50", border: "border-emerald-500", status: "DISPONIVEL" as EquipmentStatus },
    { label: "Em Uso", value: kpis?.kpiEquipamentos?.totalEmUso ?? "-", icon: Users, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/50", border: "border-sky-500", status: "EM_USO" as EquipmentStatus },
    { label: "Manutencao", value: kpis?.kpiEquipamentos?.totalManutencao ?? "-", icon: Wrench, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-500", status: "MANUTENCAO" as EquipmentStatus },
    { label: "Provisorios", value: kpis?.kpiEquipamentos?.totalProvisorio ?? "-", icon: AlertTriangle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/50", border: "border-rose-500", status: "PROVISORIO" as EquipmentStatus },
    { label: "Baixado", value: kpis?.kpiEquipamentos?.totalBaixado ?? "-", icon: Archive, color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-50 dark:bg-gray-800", border: "border-gray-400 dark:border-gray-600", status: "BAIXADO" as EquipmentStatus },
    ...(isAdmin ? [{ label: "Excluidos", value: kpis?.kpiEquipamentos?.totalExcluido ?? "-", icon: Archive, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800", border: "border-slate-500", status: "EXCLUIDO" as EquipmentStatus }] : []),
    { label: "Inserviveis", value: kpis?.kpiEquipamentos?.totalInservivel ?? "-", icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/50", border: "border-red-500", status: "INSERVIVEL" as EquipmentStatus },
  ];

  const EQUIPMENT_TYPES: EquipmentType[] = ["PC", "MONITOR", "TECLADO", "NOTEBOOK", "IMPRESSORA", "ROTEADOR", "SWITCH", "SERVIDOR", "ESTABILIZADOR", "NOBREAK", "ROTULADORA", "ARMAZENAMENTO", "OUTROS"];
  const EQUIPMENT_STATUSES: EquipmentStatus[] = ["DISPONIVEL", "INSERVIVEL", "PROVISORIO", "EM_USO", "MANUTENCAO", "BAIXADO", "EXCLUIDO"];

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Top bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-[18px] text-foreground" style={{ fontWeight: 700 }}>
            Inventario de Ativos
          </h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Gerencie todos os PCs da unidade
          </p>
        </div>
        <div className="flex gap-2.5 w-full md:w-auto">
          {canCreateEquipment && (
            <button
              onClick={() => {
                setEditingEquipment(null);
                setModalOpen(true);
              }}
              className="flex-1 md:flex-none bg-primary hover:bg-[#075985] text-white px-4 py-2.5 rounded-lg text-[13px] shadow-lg shadow-sky-600/10 transition-all duration-200 flex items-center justify-center gap-2"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-4 h-4" />
              Novo Equipamento
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards — Métricas de PCs (bloco principal: destaque visual + hierarquia) */}
      <div className="mb-4 sm:mb-6 rounded-xl border-l-4 border-primary bg-sky-50/70 dark:bg-sky-950/40 p-3 sm:p-4 md:p-5 shadow-sm border border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Monitor className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          </div>
          <p className="text-[12px] sm:text-[13px] text-primary uppercase tracking-wider truncate" style={{ fontWeight: 700 }}>
            Metricas de PCs
          </p>
        </div>
        <p className="text-[11px] text-sky-700 dark:text-sky-300/90 mb-2 sm:mb-3 ml-0 sm:ml-10">
          Apenas computadores.
        </p>
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 ${isAdmin ? "xl:grid-cols-8" : "xl:grid-cols-7"} gap-2 sm:gap-3 md:gap-4`}>
          {/* Card Total de PCs (métrica geral) — clicável: filtra tabela só por tipo PC */}
          <div
            onClick={() => {
              const isTotalPcsSelected = filterStatusSource === "pcs" && filterStatus === "";
              if (isTotalPcsSelected) {
                setFilterStatus(""); setFilterStatusSource(null); setCurrentPage(0);
              } else {
                setFilterStatus(""); setFilterStatusSource("pcs"); setCurrentPage(0); setSelectedSector(null); setFilterSetorId(""); setFilterTipo("");
                setTimeout(() => tableSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
              }
            }}
            className={`bg-card rounded-xl p-3 sm:p-4 md:p-5 border-l-[3px] border-primary border border-border flex justify-between items-center shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer min-w-0 ${filterStatusSource === "pcs" && filterStatus === "" ? "ring-2 ring-primary ring-offset-2" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate" style={{ fontWeight: 700 }}>{kpiPcsTotalCard.label}</p>
              <p className="text-[18px] sm:text-[22px] md:text-[24px] text-foreground mt-0.5 sm:mt-1 tabular-nums" style={{ fontWeight: 700 }}>
                {kpisLoading ? <span className="animate-pulse text-muted-foreground">--</span> : kpiPcsTotalCard.value}
              </p>
            </div>
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex-shrink-0 ${kpiPcsTotalCard.bg} ${kpiPcsTotalCard.color} flex items-center justify-center`}>
              <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          {kpiPcsCards.map((kpi) => {
            const Icon = kpi.icon;
            const isSelected = filterStatus === kpi.status && filterStatusSource === "pcs";
            return (
              <div
                key={`pcs-${kpi.label}`}
                onClick={() => {
                  if (isSelected) { setFilterStatus(""); setFilterStatusSource(null); setCurrentPage(0); } else {
                    setFilterStatus(kpi.status); setFilterStatusSource("pcs"); setCurrentPage(0); setSelectedSector(null); setFilterSetorId(""); setFilterTipo("");
                    setTimeout(() => tableSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                  }
                }}
                className={`bg-card rounded-xl p-3 sm:p-4 md:p-5 border-l-[3px] border border-border ${kpi.border} flex justify-between items-center shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer min-w-0 ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate" style={{ fontWeight: 700 }}>{kpi.label}</p>
                  <p className="text-[18px] sm:text-[22px] md:text-[24px] text-foreground mt-0.5 sm:mt-1 tabular-nums" style={{ fontWeight: 700 }}>
                    {kpisLoading ? <span className="animate-pulse text-muted-foreground">--</span> : kpi.value}
                  </p>
                </div>
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex-shrink-0 ${kpi.bg} ${kpi.color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI Cards — Métricas de Equipamentos (bloco secundário: estilo distinto) */}
      <div className="mb-4 sm:mb-6 rounded-xl border-l-4 border-slate-300 dark:border-slate-600 bg-gray-50/80 dark:bg-slate-900/50 p-3 sm:p-4 md:p-5 shadow-sm border border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-200/80 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
            <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <p className="text-[12px] sm:text-[13px] text-slate-600 dark:text-slate-400 uppercase tracking-wider truncate" style={{ fontWeight: 700 }}>
            Metricas de todos os equipamentos
          </p>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 sm:mb-3 ml-0 sm:ml-10">
          Resumo geral (PCs, monitores, impressoras, etc.).
        </p>
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 ${isAdmin ? "xl:grid-cols-8" : "xl:grid-cols-7"} gap-2 sm:gap-2.5 md:gap-3`}>
          {/* Card Total de Equipamentos (métrica geral) — clicável: remove filtros de card e mostra todos */}
          <div
            onClick={() => {
              const isTotalEqSelected = filterStatus === "" && filterStatusSource === null && filterTipo === "";
              if (isTotalEqSelected) return;
              setFilterStatus(""); setFilterStatusSource(null); setFilterTipo(""); setCurrentPage(0); setSelectedSector(null); setFilterSetorId("");
              setTimeout(() => tableSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
            }}
            className={`bg-card rounded-lg p-2.5 sm:p-3 md:p-4 border-l-[3px] border border-border border-slate-400 flex justify-between items-center shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer min-w-0 ${filterStatus === "" && filterStatusSource === null && filterTipo === "" ? "ring-2 ring-primary ring-offset-2" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate" style={{ fontWeight: 700 }}>{kpiEquipamentosTotalCard.label}</p>
              <p className="text-[16px] sm:text-[18px] md:text-[20px] text-foreground mt-0.5 tabular-nums" style={{ fontWeight: 700 }}>
                {kpisLoading ? <span className="animate-pulse text-muted-foreground">--</span> : kpiEquipamentosTotalCard.value}
              </p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex-shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400">
              <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          {kpiEquipamentosCards.map((kpi) => {
            const Icon = kpi.icon;
            const isSelected = filterStatus === kpi.status && filterStatusSource === "equipamentos";
            return (
              <div
                key={`eq-${kpi.label}`}
                onClick={() => {
                  if (isSelected) { setFilterStatus(""); setFilterStatusSource(null); setCurrentPage(0); } else {
                    setFilterStatus(kpi.status); setFilterStatusSource("equipamentos"); setCurrentPage(0); setSelectedSector(null); setFilterSetorId(""); setFilterTipo("");
                    setTimeout(() => tableSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                  }
                }}
                className={`bg-card rounded-lg p-2.5 sm:p-3 md:p-4 border-l-[3px] border border-border ${kpi.border} flex justify-between items-center shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer min-w-0 ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate" style={{ fontWeight: 700 }}>{kpi.label}</p>
                  <p className="text-[16px] sm:text-[18px] md:text-[20px] text-foreground mt-0.5 tabular-nums" style={{ fontWeight: 700 }}>
                    {kpisLoading ? <span className="animate-pulse text-muted-foreground">--</span> : kpi.value}
                  </p>
                </div>
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex-shrink-0 ${kpi.bg} ${kpi.color} flex items-center justify-center`}>
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Panel */}
      <div className="mb-6 space-y-3">
          {/* Cards de setores */}
          <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-[13px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 700 }}>
                Distribuicao de Equipamentos por Setor
              </h4>
              <div className="flex items-center gap-3">
                {selectedSector && (
                  <button
                    onClick={() => { setSelectedSector(null); setFilterSetorId(""); setFilterTipo(""); }}
                    className="flex items-center gap-1.5 text-[12px] text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpar seleção
                  </button>
                )}
                <span className="text-[12px] text-muted-foreground">
                  Total:{" "}
                  <span className="text-foreground" style={{ fontWeight: 700 }}>
                    {kpis?.kpiEquipamentos?.totalGeral ?? "-"}
                  </span>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {(sectorStats ?? []).map((s) => {
                const pct = (kpis?.kpiEquipamentos?.totalGeral ?? 0) > 0 ? Math.round((s.totalItens / (kpis?.kpiEquipamentos?.totalGeral ?? 1)) * 100) : 0;
                const isSelected = selectedSector?.acronym === s.acronym;
                return (
                  <button
                    key={s.acronym}
                    onClick={() => handleSectorClick(s)}
                    className={`text-left rounded-xl p-3 border transition-all duration-200 ${isSelected
                      ? "bg-sky-50 dark:bg-sky-950/50 border-sky-400 dark:border-sky-500 shadow-sm ring-2 ring-sky-400/20 dark:ring-sky-500/30"
                      : "bg-muted border-border hover:border-sky-300 dark:hover:border-sky-600 hover:bg-sky-50/40 dark:hover:bg-sky-950/30 hover:shadow-sm"
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span
                        className={`text-[12px] ${isSelected ? "text-sky-600 dark:text-sky-300" : "text-primary"}`}
                        style={{ fontWeight: 700 }}
                      >
                        {s.acronym}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-[18px] text-foreground" style={{ fontWeight: 700 }}>
                          {s.totalItens}
                        </span>
                        {isSelected && <ChevronDown className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 mt-1" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 min-w-0 bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${isSelected ? "bg-sky-500 dark:bg-sky-400" : "bg-sky-400 dark:bg-sky-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums font-medium flex-shrink-0" title={`${pct}% do total de equipamentos`}>
                        {pct}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{s.fullName}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Breakdown de tipos do setor selecionado */}
          {selectedSector && (
            <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center">
                  <Filter className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                    {selectedSector.fullName}
                    <span className="ml-1.5 text-sky-600 dark:text-sky-400 text-[12px]">({selectedSector.acronym})</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Clique em um tipo para filtrar a tabela
                  </p>
                </div>
                {filterTipo && (
                  <button
                    onClick={() => setFilterTipo("")}
                    className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remover filtro de tipo
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5">
                {(Object.entries(selectedSector.distributionByType) as [EquipmentType, number][])
                  .sort(([, a], [, b]) => b - a)
                  .map(([tipo, qtd]) => {
                    const TypeIcon = getTypeIcon(tipo);
                    const isActive = filterTipo === tipo;
                    return (
                      <button
                        key={tipo}
                        onClick={() => handleTypeClick(tipo)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[13px] transition-all duration-150 ${isActive
                          ? "bg-primary text-white border-primary shadow-md shadow-sky-600/15"
                          : "bg-muted text-foreground border-border hover:border-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-700 dark:hover:text-sky-300"
                          }`}
                        style={{ fontWeight: isActive ? 600 : 500 }}
                      >
                        <TypeIcon className={`w-4 h-4 ${isActive ? "text-white/80" : "text-muted-foreground"}`} />
                        <span>{EQUIPMENT_TYPE_LABELS[tipo]}</span>
                        <span
                          className={`ml-1 text-[12px] px-1.5 py-0.5 rounded-full ${isActive
                            ? "bg-white/20 text-white"
                            : "bg-muted text-muted-foreground"
                            }`}
                          style={{ fontWeight: 700 }}
                        >
                          {qtd}
                        </span>
                      </button>
                    );
                  })}
              </div>

              {/* Indicador de filtro ativo */}
              {filterTipo && (
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                  <p className="text-[12px] text-sky-600 dark:text-sky-400" style={{ fontWeight: 500 }}>
                    Tabela filtrada por:{" "}
                    <span style={{ fontWeight: 700 }}>{selectedSector.acronym}</span>
                    {" "} → <span style={{ fontWeight: 700 }}>{EQUIPMENT_TYPE_LABELS[filterTipo]}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

      {/* Table section */}
      <div ref={tableSectionRef} className="bg-card rounded-xl shadow-sm border border-border overflow-hidden scroll-mt-4">
        {/* Filters */}
        <div className="p-3 sm:p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            <div className="col-span-1 sm:col-span-2 lg:col-span-4">
              <label className="block text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                Busca Geral
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(0); }}
                  type="text"
                  placeholder="Patrimonio, Serial, Descricao, Marca..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all bg-background"
                />
              </div>
            </div>
            <div className="col-span-1 sm:col-span-1 lg:col-span-3">
              <label className="block text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                Setor
              </label>
              <select
                value={filterSetorId}
                onChange={(e) => { setFilterSetorId(e.target.value); setCurrentPage(0); }}
                className="w-full px-3 py-2.5 rounded-lg border border-border focus:border-sky-400 text-[13px] outline-none bg-background"
              >
                <option value="">Todos os Setores</option>
                {[...(sectors ?? [])]
                  .sort((a, b) => `${a.acronym} - ${a.fullName}`.localeCompare(`${b.acronym} - ${b.fullName}`))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.acronym} - {s.fullName}
                    </option>
                  ))}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-1 lg:col-span-2">
              <label className="block text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                Tipo
              </label>
              <select
                value={filterStatusSource === "pcs" ? "PC" : filterTipo}
                onChange={(e) => { setFilterStatusSource(null); setFilterTipo(e.target.value as EquipmentType | ""); setCurrentPage(0); }}
                className="w-full px-3 py-2.5 rounded-lg border border-border focus:border-sky-400 text-[13px] outline-none bg-background"
              >
                <option value="">Todos</option>
                {[...EQUIPMENT_TYPES]
                  .sort((a, b) => EQUIPMENT_TYPE_LABELS[a].localeCompare(EQUIPMENT_TYPE_LABELS[b]))
                  .map((t) => (
                    <option key={t} value={t}>{EQUIPMENT_TYPE_LABELS[t]}</option>
                  ))}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-1 lg:col-span-2">
              <label className="block text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value as EquipmentStatus | ""); setFilterStatusSource(null); setCurrentPage(0); }}
                className="w-full px-3 py-2.5 rounded-lg border border-border focus:border-sky-400 text-[13px] outline-none bg-background"
              >
                <option value="">Todos</option>
                {[...EQUIPMENT_STATUSES]
                  .sort((a, b) => EQUIPMENT_STATUS_LABELS[a].localeCompare(EQUIPMENT_STATUS_LABELS[b]))
                  .map((s) => (
                    <option key={s} value={s}>{EQUIPMENT_STATUS_LABELS[s]}</option>
                  ))}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-1 lg:col-span-1 flex items-end">
              <button
                onClick={clearFilters}
                className="w-full py-2.5 bg-background border border-border hover:bg-muted text-muted-foreground rounded-lg text-[13px] transition-colors flex items-center justify-center gap-1.5"
                style={{ fontWeight: 500 }}
              >
                <X className="w-3.5 h-3.5" />
                Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted">
                {["Patrimonio", "Serial", "Item / Marca", "Descricao", "Rede", "Setor", "Resp.", "Status", "Acoes"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 md:px-6 py-3.5 text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap ${i === 3 ? "hidden lg:table-cell" :
                      i === 4 ? "hidden xl:table-cell" :
                        i === 6 ? "hidden md:table-cell" :
                          i === 8 ? "text-right" : ""
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
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 md:px-6 py-3.5">
                        <div className="h-4 bg-muted rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Search className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[14px] text-muted-foreground" style={{ fontWeight: 500 }}>
                          {hasFilters ? "Nenhum equipamento encontrado" : "Nenhum equipamento cadastrado"}
                        </p>
                        <p className="text-[12px] text-muted-foreground/80 mt-0.5">
                          {hasFilters ? "Tente ajustar os filtros de busca" : "Cadastre o primeiro equipamento da unidade"}
                        </p>
                      </div>
                      {!hasFilters && canCreateEquipment && (
                        <button
                          onClick={() => { setEditingEquipment(null); setModalOpen(true); }}
                          className="flex items-center gap-2 bg-primary hover:bg-[#075985] text-white px-4 py-2 rounded-lg text-[13px] shadow-sm transition-all"
                          style={{ fontWeight: 600 }}
                        >
                          <Plus className="w-4 h-4" />
                          Cadastrar primeiro equipamento
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayItems.map((equip) => {
                  const TypeIcon = getTypeIcon(equip.type);
                  const hasAsset = !isEquipmentWithoutAsset(equip.assetNumber, equip.id);
                  const hasDefect = !!equip.hasOpenDefect;
                  return (
                    <tr
                      key={equip.id}
                      className={`transition-colors duration-150 cursor-pointer ${hasDefect ? "row-defect-pulse hover:bg-amber-100/80 dark:hover:bg-amber-950/40" : "hover:bg-muted/50"}`}
                      onClick={() => setViewingEquipment(equip)}
                      title={hasDefect ? "Possui defeito em aberto" : undefined}
                    >
                      <td className="px-4 md:px-6 py-3.5 whitespace-nowrap">
                        <span
                          className={`text-[13px] ${hasAsset ? "text-foreground" : "text-rose-500 italic"}`}
                          style={{ fontWeight: hasAsset ? 600 : 400 }}
                        >
                          {hasAsset ? equip.assetNumber : "Sem Patrimônio"}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3.5 text-muted-foreground whitespace-nowrap text-[12px]">
                        {equip.serialNumber || <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="px-4 md:px-6 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <TypeIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                              {getEquipmentTypeLabel(equip.type)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{equip.brand}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-3.5 text-muted-foreground max-w-[200px] truncate hidden lg:table-cell text-[12px]">
                        {equip.description || <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="px-4 md:px-6 py-3.5 whitespace-nowrap hidden xl:table-cell">
                        {equip.hostname || equip.ipAddress ? (
                          <div>
                            <p className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                              {equip.hostname || "-"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{equip.ipAddress || "-"}</p>
                          </div>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3.5 whitespace-nowrap">
                        <span className="text-[12px] text-primary bg-sky-50 dark:bg-sky-950/60 dark:text-sky-300 px-2 py-1 rounded" style={{ fontWeight: 600 }}>
                          {equip.currentSector.acronym}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3.5 text-muted-foreground whitespace-nowrap hidden md:table-cell text-[12px]">
                        {equip.equipmentUser || <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="px-4 md:px-6 py-3.5 whitespace-nowrap">
                        <StatusBadge status={equip.status} />
                      </td>
                      <td className="px-4 md:px-6 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {canEditEquipment && (
                            <button
                              onClick={() => handleEdit(equip)}
                              className="p-2 text-muted-foreground hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg transition-all duration-150"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteEquipment && (
                            <button
                              onClick={() => handleDelete(equip)}
                              className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-all duration-150"
                              title="Excluir equipamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-muted/50 px-4 md:px-6 py-3 border-t border-border flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
            <span>
              Pagina{" "}
              <span style={{ fontWeight: 600 }} className="text-foreground">{Math.min(currentPage + 1, Math.max(totalPages, 1))}</span>
              {" "}de{" "}
              <span style={{ fontWeight: 600 }} className="text-foreground">{Math.max(totalPages, 1)}</span>
            </span>
            {totalPages > 1 && (
              <span className="flex items-center gap-1.5">
                <label htmlFor="page-jump" className="text-muted-foreground">Ir para:</label>
                <input
                  id="page-jump"
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage + 1}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") return;
                    const n = Number.parseInt(raw, 10);
                    if (Number.isNaN(n)) return;
                    const clamped = Math.min(Math.max(n, 1), totalPages);
                    setCurrentPage(clamped - 1);
                  }}
                  className="w-14 px-2 py-1 rounded-md border border-border bg-background text-[12px] text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none tabular-nums"
                />
              </span>
            )}
            <span className="hidden sm:inline text-muted-foreground/70">
              ({totalElements} registro{totalElements !== 1 ? "s" : ""})
            </span>
          </div>
          {totalPages > 1 && (() => {
            const maxVisible = 7;
            const half = Math.floor(maxVisible / 2);
            let start = Math.max(0, currentPage - half);
            const end = Math.min(totalPages, start + maxVisible);
            start = Math.max(0, end - maxVisible);
            const pages = Array.from({ length: end - start }, (_, i) => start + i);
            return (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {start > 0 && (
                  <>
                    <button
                      onClick={() => setCurrentPage(0)}
                      className="w-8 h-8 rounded-lg text-[13px] text-muted-foreground hover:bg-muted transition-all duration-150"
                    >
                      1
                    </button>
                    {start > 1 && <span className="px-1 text-muted-foreground text-[13px]">…</span>}
                  </>
                )}
                {pages.map((i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`w-8 h-8 rounded-lg text-[13px] transition-all duration-150 ${currentPage === i
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                      }`}
                    style={{ fontWeight: currentPage === i ? 600 : 400 }}
                  >
                    {i + 1}
                  </button>
                ))}
                {end < totalPages && (
                  <>
                    {end < totalPages - 1 && <span className="px-1 text-muted-foreground text-[13px]">…</span>}
                    <button
                      onClick={() => setCurrentPage(totalPages - 1)}
                      className="w-8 h-8 rounded-lg text-[13px] text-muted-foreground hover:bg-muted transition-all duration-150"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Equipment Modal */}
      <EquipmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEquipment(null); }}
        onSaved={handleSaved}
        equipment={editingEquipment}
        sectors={sectors ?? []}
      />

      {/* Modal de detalhes do equipamento */}
      <EquipmentDetailsModal
        open={!!viewingEquipment}
        onClose={() => setViewingEquipment(null)}
        equipment={viewingEquipment}
        onEdit={
          canEditEquipment && viewingEquipment
            ? () => {
              setViewingEquipment(null);
              handleEdit(viewingEquipment);
            }
            : undefined
        }
      />

      {/* Confirmação: marcar como excluído (status EXCLUIDO) */}
      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title="Marcar como Excluído"
        message={
          deleteTarget
            ? `O equipamento será marcado como excluído e sairá da listagem geral.\nAdministradores ainda poderão visualizá-lo no card "Excluídos".\n\n${isEquipmentWithoutAsset(deleteTarget.assetNumber, deleteTarget.id) ? "Sem patrimônio" : deleteTarget.assetNumber}${deleteTarget.serialNumber ? ` · ${deleteTarget.serialNumber}` : ""} — ${deleteTarget.brand}`
            : ""
        }
        requirePhrase="CONFIRMAR"
        confirmLabel="Marcar como excluído"
        cancelLabel="Cancelar"
        loading={excludeMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
