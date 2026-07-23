import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Filter, FileBarChart, ClipboardList, Search, Check } from "lucide-react";
import { sectorApi } from "../api/sector.api";
import { equipmentApi } from "../api/equipment.api";
import { reportApi, downloadBlob } from "../api/report.api";
import type { EquipmentType, EquipmentStatus, EquipmentResponseDTO } from "../types";
import { EQUIPMENT_TYPE_LABELS, EQUIPMENT_STATUS_LABELS, getEquipmentShortLabel, getEquipmentDropdownSecondary } from "../types";
import { usePageTitle } from "../hooks/usePageTitle";
import { toast } from "sonner";

const TIPOS: EquipmentType[] = [
  "PC", "MONITOR", "TECLADO", "NOTEBOOK", "IMPRESSORA", "ROTEADOR", "SWITCH",
  "SERVIDOR", "ARMAZENAMENTO", "ESTABILIZADOR", "NOBREAK", "ROTULADORA", "OUTROS",
];

const STATUSES: EquipmentStatus[] = [
  "EM_USO", "DISPONIVEL", "PROVISORIO", "MANUTENCAO", "INSERVIVEL", "BAIXADO",
];

const SELECT_CLASS =
  "w-full px-3 py-2.5 bg-background border border-border rounded-lg text-[13px] text-foreground focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all";

export function RelatoriosPage() {
  usePageTitle("Relatórios");

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="mb-6">
        <h3 className="text-[18px] text-foreground" style={{ fontWeight: 700 }}>Relatórios</h3>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Gere documentos em PDF para anexar em processos, enviar à chefia ou conferência interna.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <InventoryCard />
        <EquipmentSheetCard />
        <ExecutiveSummaryCard />
      </div>
    </div>
  );
}

// ─── Relatório de Inventário ──────────────────────────────────────────────────

function InventoryCard() {
  const [setorId, setSetorId] = useState("");
  const [tipo, setTipo] = useState<EquipmentType | "">("");
  const [status, setStatus] = useState<EquipmentStatus | "">("");
  const [generating, setGenerating] = useState(false);

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: () => sectorApi.list(),
    staleTime: 60_000,
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { blob, filename } = await reportApi.inventory({
        setorId: setorId || undefined,
        tipo: tipo || undefined,
        status: status || undefined,
      });
      downloadBlob(blob, filename);
      toast.success("Relatório gerado com sucesso.");
    } catch {
      toast.error("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="p-5 border-b border-border flex items-start gap-3">
        <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 shrink-0">
          <FileText className="w-5 h-5 text-primary" />
        </span>
        <div>
          <h4 className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>Relatório de Inventário</h4>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Lista dos bens (patrimônio, tipo, marca, status, responsável e setor) com totais.
            Opcionalmente filtre por setor, tipo ou status.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 700 }}>
          <Filter className="w-3.5 h-3.5" /> Filtros (opcionais)
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Setor</label>
            <select className={SELECT_CLASS} value={setorId} onChange={(e) => setSetorId(e.target.value)}>
              <option value="">Todos os setores</option>
              {sectors?.map((s) => (
                <option key={s.id} value={s.id}>{s.acronym} — {s.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Tipo</label>
            <select className={SELECT_CLASS} value={tipo} onChange={(e) => setTipo(e.target.value as EquipmentType | "")}>
              <option value="">Todos os tipos</option>
              {TIPOS.map((t) => <option key={t} value={t}>{EQUIPMENT_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Status</label>
            <select className={SELECT_CLASS} value={status} onChange={(e) => setStatus(e.target.value as EquipmentStatus | "")}>
              <option value="">Todos os status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{EQUIPMENT_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full sm:w-auto bg-primary hover:bg-[#075985] text-white px-5 py-2.5 rounded-lg text-[13px] shadow-lg shadow-sky-600/10 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ fontWeight: 600 }}
        >
          {generating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? "Gerando PDF..." : "Gerar PDF"}
        </button>
      </div>
    </div>
  );
}

// ─── Ficha do Equipamento ─────────────────────────────────────────────────────

function EquipmentSheetCard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EquipmentResponseDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<EquipmentResponseDTO | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const list = await equipmentApi.filter({ textoBusca: query.trim() });
      setResults(list.slice(0, 8));
    } catch {
      toast.error("Erro ao buscar equipamentos.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    try {
      const { blob, filename } = await reportApi.equipmentSheet(selected.id);
      downloadBlob(blob, filename);
      toast.success("Ficha gerada com sucesso.");
    } catch {
      toast.error("Não foi possível gerar a ficha. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="p-5 border-b border-border flex items-start gap-3">
        <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 shrink-0">
          <ClipboardList className="w-5 h-5 text-primary" />
        </span>
        <div>
          <h4 className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>Ficha do Equipamento</h4>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Uma página por bem: dados, localização atual e histórico de movimentações e defeitos.
            Busque pelo patrimônio, série, marca ou responsável.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Buscar equipamento..."
              className="w-full pl-10 pr-3 py-2.5 bg-background border border-border rounded-lg text-[13px] text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="px-4 py-2.5 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-[13px] transition-all disabled:opacity-50"
            style={{ fontWeight: 600 }}
          >
            {searching ? "..." : "Buscar"}
          </button>
        </div>

        {searched && !searching && results.length === 0 && (
          <p className="text-[12px] text-muted-foreground text-center py-2">Nenhum equipamento encontrado.</p>
        )}

        {results.length > 0 && (
          <div className="border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
            {results.map((e) => {
              const isSel = selected?.id === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className={`w-full text-left px-3 py-2.5 transition-colors flex items-center gap-2 ${isSel ? "bg-primary/10" : "hover:bg-muted/50"}`}
                >
                  <span className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${isSel ? "bg-primary border-primary" : "border-border"}`}>
                    {isSel && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] text-foreground truncate" style={{ fontWeight: 500 }}>{getEquipmentShortLabel(e)}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">{getEquipmentDropdownSecondary(e)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!selected || generating}
          className="w-full sm:w-auto bg-primary hover:bg-[#075985] text-white px-5 py-2.5 rounded-lg text-[13px] shadow-lg shadow-sky-600/10 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ fontWeight: 600 }}
        >
          {generating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? "Gerando ficha..." : "Gerar ficha (PDF)"}
        </button>
      </div>
    </div>
  );
}

// ─── Resumo Executivo ─────────────────────────────────────────────────────────

function ExecutiveSummaryCard() {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { blob, filename } = await reportApi.summary();
      downloadBlob(blob, filename);
      toast.success("Resumo executivo gerado com sucesso.");
    } catch {
      toast.error("Não foi possível gerar o resumo. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden lg:col-span-2">
      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 shrink-0">
            <FileBarChart className="w-5 h-5 text-primary" />
          </span>
          <div>
            <h4 className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>Resumo Executivo</h4>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Visão gerencial: total de equipamentos, distribuição por status, tipo e setor,
              e defeitos em aberto. Sem filtros — retrato atual do patrimônio.
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="shrink-0 bg-primary hover:bg-[#075985] text-white px-5 py-2.5 rounded-lg text-[13px] shadow-lg shadow-sky-600/10 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ fontWeight: 600 }}
        >
          {generating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? "Gerando PDF..." : "Gerar PDF"}
        </button>
      </div>
    </div>
  );
}
