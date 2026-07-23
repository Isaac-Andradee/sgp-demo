import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import {
  Truck,
  RefreshCw,
  Search,
  MapPin,
  X,
  ArrowRight,
  AlertCircle,
  Info,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { equipmentApi } from "../api/equipment.api";
import { sectorApi } from "../api/sector.api";
import type { EquipmentResponseDTO, EquipmentStatus } from "../types";
import {
  EQUIPMENT_STATUS_LABELS,
  shouldShowUserField,
  getEquipmentShortLabel,
  getEquipmentDropdownSecondary,
} from "../types";
import { toast } from "sonner";

type Tab = "transfer" | "swap";

const TRANSFER_STATUSES: EquipmentStatus[] = ["DISPONIVEL", "INSERVIVEL", "PROVISORIO", "EM_USO", "MANUTENCAO", "BAIXADO"];

/** Responsável (targetUser): opcional; se preenchido, apenas letras (Unicode), espaços, hífens e apóstrofos; máx. 100. */
const TARGET_USER_REGEX = /^[\p{L}\s\-']+$/u;
const TARGET_USER_MAX = 100;

function validateTargetUser(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  if (t.length > TARGET_USER_MAX) return "Máx. 100 caracteres.";
  if (!TARGET_USER_REGEX.test(t)) return "Nome deve conter apenas letras, espaços, hífens ou apóstrofos (ex.: Maria da Silva, Jean-Pierre).";
  return null;
}

function toTitleCase(s: string): string {
  return s.trim().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

function useEquipmentSearch(query: string, excludeId?: string) {
  const [results, setResults] = useState<EquipmentResponseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await equipmentApi.filter({ textoBusca: query });
        setResults(data.filter((e) => e.id !== excludeId).slice(0, 6));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, excludeId]);

  return { results, loading };
}

function SearchDropdown({
  items,
  query,
  onSelect,
  visible,
  loading,
}: {
  items: EquipmentResponseDTO[];
  query: string;
  onSelect: (e: EquipmentResponseDTO) => void;
  visible: boolean;
  loading: boolean;
}) {
  if (!visible || !query) return null;
  return (
    <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
      {loading ? (
        <div className="px-4 py-3 text-[13px] text-muted-foreground">Buscando...</div>
      ) : items.length === 0 ? (
        <div className="px-4 py-3 text-[13px] text-muted-foreground">Nenhum resultado encontrado.</div>
      ) : (
        items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-0"
          >
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[13px] text-foreground block" style={{ fontWeight: 600 }}>
                  {getEquipmentShortLabel(item)}
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  {getEquipmentDropdownSecondary(item)}
                </span>
              </div>
              <span className="text-[11px] text-primary bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded shrink-0" style={{ fontWeight: 500 }}>
                {item.currentSector.acronym}
              </span>
            </div>
          </button>
        ))
      )}
    </div>
  );
}

function SelectedItemCard({
  item,
  onClear,
  variant = "blue",
}: {
  item: EquipmentResponseDTO;
  onClear: () => void;
  variant?: "blue" | "red" | "green";
}) {
  const styles = {
    blue: { border: "border-sky-500", bg: "bg-sky-50 dark:bg-sky-950/50", text: "text-sky-800 dark:text-sky-200", badge: "bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300" },
    red: { border: "border-rose-400", bg: "bg-rose-50 dark:bg-rose-950/50", text: "text-rose-800 dark:text-rose-200", badge: "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300" },
    green: { border: "border-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50", text: "text-emerald-800 dark:text-emerald-200", badge: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" },
  };
  const s = styles[variant];
  return (
    <div className={`${s.bg} border ${s.border} rounded-xl p-4 mt-3`}>
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] ${s.text}`} style={{ fontWeight: 600 }}>
            {getEquipmentShortLabel(item)}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {getEquipmentDropdownSecondary(item)}
          </p>
        </div>
        <button onClick={onClear} className="text-muted-foreground hover:text-rose-500 p-1 rounded transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
        <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground bg-muted/60 p-2.5 rounded-lg flex-wrap">
        <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span style={{ fontWeight: 500 }}>Setor:</span>
        <span className={`${s.badge} px-2 py-0.5 rounded text-[11px]`} style={{ fontWeight: 600 }}>
          {item.currentSector.acronym}
        </span>
        {item.equipmentUser && (
          <span className="text-[11px] text-muted-foreground">· Responsável: {item.equipmentUser}</span>
        )}
      </div>
    </div>
  );
}

export function MovimentacaoPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("transfer");

  // Transfer state
  const [moveQuery, setMoveQuery] = useState("");
  const [moveSelected, setMoveSelected] = useState<EquipmentResponseDTO | null>(null);

  // Pré-seleção vinda do modal de edição (link "Transferência em Movimentação")
  useEffect(() => {
    const equipment = (location.state as { equipment?: EquipmentResponseDTO })?.equipment;
    if (equipment?.id) {
      setMoveSelected(equipment);
      setActiveTab("transfer");
    }
  }, [location.state]);
  const [moveDestSectorId, setMoveDestSectorId] = useState("");
  const [moveDestStatus, setMoveDestStatus] = useState<EquipmentStatus>("EM_USO");
  const [moveDestUser, setMoveDestUser] = useState("");
  const [moveDestUserError, setMoveDestUserError] = useState<string | null>(null);
  const [moveDropdownOpen, setMoveDropdownOpen] = useState(false);

  // Swap state
  const [swapOutQuery, setSwapOutQuery] = useState("");
  const [swapInQuery, setSwapInQuery] = useState("");
  const [swapOutSelected, setSwapOutSelected] = useState<EquipmentResponseDTO | null>(null);
  const [swapInSelected, setSwapInSelected] = useState<EquipmentResponseDTO | null>(null);
  const [swapDefective, setSwapDefective] = useState(false);
  const [swapDefectDescription, setSwapDefectDescription] = useState("");
  const [swapOutDropdownOpen, setSwapOutDropdownOpen] = useState(false);
  const [swapInDropdownOpen, setSwapInDropdownOpen] = useState(false);

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: sectorApi.list,
    staleTime: 60_000,
  });

  const moveSearch = useEquipmentSearch(moveQuery);
  const swapOutSearch = useEquipmentSearch(swapOutQuery, swapInSelected?.id);
  const swapInSearch = useEquipmentSearch(swapInQuery, swapOutSelected?.id);

  const moveMutation = useMutation({
    mutationFn: equipmentApi.move,
    onSuccess: () => {
      toast.success("Transferência realizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["equipments-paged"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
      queryClient.invalidateQueries({ queryKey: ["sector-stats"] });
      setMoveSelected(null);
      setMoveQuery("");
      setMoveDestSectorId("");
      setMoveDestStatus("EM_USO");
      setMoveDestUser("");
      setMoveDestUserError(null);
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string } } };
      const msg = axErr?.response?.data?.message ?? "";
      if (msg && (msg.includes("Nome deve conter") || msg.includes("letras, espaços"))) {
        setMoveDestUserError(msg);
        toast.error(msg);
      } else {
        setMoveDestUserError(null);
        toast.error(msg || "Erro ao realizar transferência.");
      }
    },
  });

  const swapMutation = useMutation({
    mutationFn: equipmentApi.swap,
    onSuccess: (_, variables) => {
      toast.success("Substituição realizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["equipments-paged"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
      queryClient.invalidateQueries({ queryKey: ["sector-stats"] });
      if (variables.isDefective && variables.outgoingEquipmentId) {
        queryClient.invalidateQueries({ queryKey: ["equipment-defects-open", variables.outgoingEquipmentId] });
      }
      setSwapOutSelected(null);
      setSwapInSelected(null);
      setSwapOutQuery("");
      setSwapInQuery("");
      setSwapDefective(false);
      setSwapDefectDescription("");
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string } } };
      toast.error(axErr?.response?.data?.message ?? "Erro ao realizar substituição.");
    },
  });

  const handleMoveConfirm = () => {
    if (!moveSelected || !moveDestSectorId) return;
    if (shouldShowUserField(moveDestStatus) && moveDestUser.trim()) {
      const err = validateTargetUser(moveDestUser);
      if (err) {
        setMoveDestUserError(err);
        toast.error(err);
        return;
      }
      setMoveDestUserError(null);
    }
    const targetUserValue = shouldShowUserField(moveDestStatus) && moveDestUser.trim()
      ? toTitleCase(moveDestUser)
      : undefined;
    moveMutation.mutate({
      equipmentId: moveSelected.id,
      targetSectorId: moveDestSectorId,
      targetStatus: moveDestStatus,
      targetUser: targetUserValue,
    });
  };

  const handleSwapConfirm = () => {
    if (!swapOutSelected || !swapInSelected) return;
    swapMutation.mutate({
      outgoingEquipmentId: swapOutSelected.id,
      incomingEquipmentId: swapInSelected.id,
      isDefective: swapDefective,
      defectDescription: swapDefective && swapDefectDescription.trim()
        ? swapDefectDescription.trim()
        : undefined,
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-4xl mx-auto">
        {/* Tab buttons */}
        <div className="flex bg-card rounded-xl p-1.5 shadow-sm border border-border mb-6">
          <button
            onClick={() => setActiveTab("transfer")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[13px] transition-all duration-200 ${
              activeTab === "transfer" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
            }`}
            style={{ fontWeight: activeTab === "transfer" ? 600 : 500 }}
          >
            <Truck className="w-4 h-4" />
            Transferencia
          </button>
          <button
            onClick={() => setActiveTab("swap")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[13px] transition-all duration-200 ${
              activeTab === "swap" ? "bg-amber-600 text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
            }`}
            style={{ fontWeight: activeTab === "swap" ? 600 : 500 }}
          >
            <RefreshCw className="w-4 h-4" />
            Substituicao
          </button>
        </div>

        {/* TRANSFER TAB */}
        {activeTab === "transfer" && (
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="flex items-start gap-3 bg-sky-50 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-800 p-4">
              <Info className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-sky-700 dark:text-sky-300">
                Use para alocar um item disponivel ou mudar um item de setor.
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1 */}
              <div className="bg-muted p-5 rounded-xl border border-border">
                <label className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-2" style={{ fontWeight: 700 }}>
                  1. Selecionar Equipamento
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={moveQuery}
                    onChange={(e) => { setMoveQuery(e.target.value); setMoveDropdownOpen(true); }}
                    onFocus={() => setMoveDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setMoveDropdownOpen(false), 200)}
                    type="text"
                    placeholder="Busque por patrimonio, serial, marca..."
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all"
                  />
                  <SearchDropdown
                    items={moveSearch.results}
                    loading={moveSearch.loading}
                    query={moveQuery}
                    onSelect={(e) => { setMoveSelected(e); setMoveDropdownOpen(false); setMoveQuery(""); }}
                    visible={moveDropdownOpen}
                  />
                </div>
                {moveSelected && (
                  <SelectedItemCard item={moveSelected} onClear={() => setMoveSelected(null)} />
                )}
              </div>

              {/* Step 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-2" style={{ fontWeight: 700 }}>
                    2. Setor Destino
                  </label>
                  <select
                    value={moveDestSectorId}
                    onChange={(e) => setMoveDestSectorId(e.target.value)}
                    className="w-full px-3 py-3 border border-border rounded-lg focus:border-sky-400 text-[13px] outline-none bg-background"
                  >
                    <option value="">Selecione o setor...</option>
                    {[...(sectors ?? [])]
                      .sort((a, b) => `${a.acronym} - ${a.fullName}`.localeCompare(`${b.acronym} - ${b.fullName}`))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.acronym} - {s.fullName}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-2" style={{ fontWeight: 700 }}>
                    Status no Destino
                  </label>
                  <select
                    value={moveDestStatus}
                    onChange={(e) => {
                      setMoveDestStatus(e.target.value as EquipmentStatus);
                      setMoveDestUserError(null);
                    }}
                    className="w-full px-3 py-3 border border-border rounded-lg focus:border-sky-400 text-[13px] outline-none bg-background"
                  >
                    {[...TRANSFER_STATUSES]
                      .sort((a, b) => EQUIPMENT_STATUS_LABELS[a].localeCompare(EQUIPMENT_STATUS_LABELS[b]))
                      .map((s) => (
                        <option key={s} value={s}>{EQUIPMENT_STATUS_LABELS[s]}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Responsável */}
              {shouldShowUserField(moveDestStatus) && (
                <div>
                  <label className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-2" style={{ fontWeight: 700 }}>
                    Novo Responsavel
                  </label>
                  <input
                    value={moveDestUser}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMoveDestUser(v);
                      setMoveDestUserError(validateTargetUser(v));
                    }}
                    onBlur={() => {
                      if (moveDestUser.trim()) {
                        const formatted = toTitleCase(moveDestUser);
                        if (formatted !== moveDestUser) setMoveDestUser(formatted);
                      }
                    }}
                    type="text"
                    placeholder="Ex.: Maria da Silva, Jean-Pierre"
                    maxLength={TARGET_USER_MAX}
                    className={`w-full px-3 py-3 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] bg-background transition-all ${moveDestUserError ? "border-red-400" : "border-border"}`}
                  />
                  {moveDestUserError && <p className="text-[11px] text-red-500 mt-1">{moveDestUserError}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">Apenas letras, espaços, hífens ou apóstrofos (máx. 100 caracteres).</p>
                </div>
              )}

              {/* Confirm */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleMoveConfirm}
                  disabled={!moveSelected || !moveDestSectorId || moveMutation.isPending}
                  className="w-full md:w-auto bg-primary hover:bg-[#075985] disabled:bg-muted text-white px-6 py-3 rounded-xl text-[14px] shadow-lg shadow-sky-600/10 transition-all duration-200 flex items-center justify-center gap-2 disabled:shadow-none"
                  style={{ fontWeight: 600 }}
                >
                  {moveMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Confirmar Transferencia
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SWAP TAB */}
        {activeTab === "swap" && (
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-100 dark:border-amber-800 p-4">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-amber-700 dark:text-amber-300">
                Permuta: O novo herda o lugar do antigo. O antigo herda o lugar do novo.
              </p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card border-2 border-border items-center justify-center shadow-sm">
                  <RefreshCw className="w-4 h-4 text-amber-600" />
                </div>

                {/* Item Saindo */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-rose-200">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <h4 className="text-[14px] text-rose-600" style={{ fontWeight: 700 }}>
                      Item Saindo
                    </h4>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={swapOutQuery}
                      onChange={(e) => { setSwapOutQuery(e.target.value); setSwapOutDropdownOpen(true); }}
                      onFocus={() => setSwapOutDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setSwapOutDropdownOpen(false), 200)}
                      placeholder="Busque o item que vai sair..."
                      className="w-full pl-10 pr-4 py-3 border border-rose-200 rounded-lg focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 outline-none text-[13px] transition-all"
                    />
                    <SearchDropdown
                      items={swapOutSearch.results}
                      loading={swapOutSearch.loading}
                      query={swapOutQuery}
                      onSelect={(e) => { setSwapOutSelected(e); setSwapOutDropdownOpen(false); setSwapOutQuery(""); }}
                      visible={swapOutDropdownOpen}
                    />
                  </div>
                  {swapOutSelected && (
                    <SelectedItemCard item={swapOutSelected} onClear={() => setSwapOutSelected(null)} variant="red" />
                  )}
                  <div className={`border rounded-xl transition-all duration-200 ${swapDefective ? "border-rose-300 dark:border-rose-600 bg-rose-50 dark:bg-rose-950/50" : "border-rose-100 dark:border-rose-800/50 bg-rose-50/50 dark:bg-rose-950/30"}`}>
                    <label className="flex items-center gap-3 p-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={swapDefective}
                        onChange={(e) => {
                          setSwapDefective(e.target.checked);
                          if (!e.target.checked) setSwapDefectDescription("");
                        }}
                        className="w-4 h-4 rounded border-rose-300 dark:border-rose-600 text-rose-600 dark:text-rose-400 focus:ring-rose-500 flex-shrink-0"
                      />
                      <div>
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                          Possui defeito?
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Se sim, o item vai para MANUTENCAO no setor de estoque (TIC).
                        </p>
                      </div>
                    </label>

                    {/* Campo de descrição do defeito — aparece apenas se marcado */}
                    {swapDefective && (
                      <div className="px-4 pb-4">
                        <label className="block text-[11px] text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1.5" style={{ fontWeight: 700 }}>
                          Descreva o defeito
                        </label>
                        <textarea
                          value={swapDefectDescription}
                          onChange={(e) => setSwapDefectDescription(e.target.value)}
                          placeholder="Ex: Não liga, tela quebrada, teclado com teclas travadas..."
                          rows={3}
                          maxLength={500}
                          className="w-full px-3 py-2.5 border border-rose-200 dark:border-rose-700 bg-background dark:bg-rose-950/30 rounded-lg focus:border-rose-400 dark:focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 outline-none text-[13px] transition-all resize-none text-foreground placeholder:text-muted-foreground"
                        />
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                            Será anexado à descrição atual do equipamento.
                          </p>
                          <span className="text-[11px] text-muted-foreground">
                            {swapDefectDescription.length}/500
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Item Entrando */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-emerald-200">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h4 className="text-[14px] text-emerald-600" style={{ fontWeight: 700 }}>
                      Item Entrando
                    </h4>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={swapInQuery}
                      onChange={(e) => { setSwapInQuery(e.target.value); setSwapInDropdownOpen(true); }}
                      onFocus={() => setSwapInDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setSwapInDropdownOpen(false), 200)}
                      placeholder="Busque o item que vai entrar..."
                      className="w-full pl-10 pr-4 py-3 border border-emerald-200 rounded-lg focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10 outline-none text-[13px] transition-all"
                    />
                    <SearchDropdown
                      items={swapInSearch.results}
                      loading={swapInSearch.loading}
                      query={swapInQuery}
                      onSelect={(e) => { setSwapInSelected(e); setSwapInDropdownOpen(false); setSwapInQuery(""); }}
                      visible={swapInDropdownOpen}
                    />
                  </div>
                  {swapInSelected && (
                    <SelectedItemCard item={swapInSelected} onClear={() => setSwapInSelected(null)} variant="green" />
                  )}
                </div>
              </div>

              {/* Confirm */}
              <div className="flex justify-end pt-6">
                <button
                  onClick={handleSwapConfirm}
                  disabled={!swapOutSelected || !swapInSelected || swapMutation.isPending}
                  className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 disabled:bg-muted text-white px-6 py-3 rounded-xl text-[14px] shadow-lg shadow-amber-600/10 transition-all duration-200 flex items-center justify-center gap-2 disabled:shadow-none"
                  style={{ fontWeight: 600 }}
                >
                  {swapMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Executar Substituicao
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
