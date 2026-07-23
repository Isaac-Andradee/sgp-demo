import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { History, CheckCircle, Package, Search } from "lucide-react";
import { equipmentApi } from "../api/equipment.api";
import type { DefectResponse, EquipmentResponseDTO } from "../types";
import { EQUIPMENT_TYPE_LABELS, isEquipmentWithoutAsset, getEquipmentShortLabel, getEquipmentDropdownSecondary } from "../types";

const CURRENT_YEAR = new Date().getFullYear();
const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

function formatDefectDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoricoDefeitosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlEquipmentId = searchParams.get("equipmentId") ?? "";

  const [equipmentId, setEquipmentId] = useState(() => urlEquipmentId || "");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (urlEquipmentId) setEquipmentId(urlEquipmentId);
  }, [urlEquipmentId]);

  const { data: equipmentList = [] } = useQuery({
    queryKey: ["equipments-list-all"],
    queryFn: () => equipmentApi.filter({}),
    staleTime: 60_000,
  });

  // Busca todos os defeitos resolvidos do equipamento para extrair os anos disponíveis
  const { data: allResolvedDefects = [] } = useQuery({
    queryKey: ["equipment-defects-resolved-years", equipmentId],
    queryFn: () => equipmentApi.getDefects(equipmentId, { status: "RESOLVIDO" }),
    enabled: !!equipmentId,
    staleTime: 60_000,
  });

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const d of allResolvedDefects) {
      if (d.resolvedAt) {
        years.add(new Date(d.resolvedAt).getFullYear());
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [allResolvedDefects]);

  const yearsForSelector = availableYears.length > 0 ? availableYears : [CURRENT_YEAR];

  // Manter ano selecionado dentro da lista de anos disponíveis (ex.: ao trocar de equipamento)
  useEffect(() => {
    if (yearsForSelector.length === 0) return;
    if (!yearsForSelector.includes(year)) setYear(yearsForSelector[0]);
  }, [equipmentId, yearsForSelector]);

  const { data: defects = [], isLoading } = useQuery({
    queryKey: ["equipment-defects-history", equipmentId, year, month],
    queryFn: () =>
      equipmentApi.getDefects(equipmentId, { status: "RESOLVIDO", year, month }),
    enabled: !!equipmentId,
    staleTime: 30_000,
  });

  const selectedEquipment = useMemo(
    () => equipmentList.find((e: EquipmentResponseDTO) => e.id === equipmentId),
    [equipmentList, equipmentId]
  );

  const filteredEquipments = useMemo(() => {
    const term = equipmentSearch.trim().toLowerCase();
    if (!term) return equipmentList;
    return equipmentList.filter((e) => {
      const values: string[] = [];
      if (e.assetNumber) values.push(e.assetNumber);
      if (e.serialNumber) values.push(e.serialNumber);
      if (e.hostname) values.push(e.hostname);
      if (e.ipAddress) values.push(e.ipAddress);
      return values.some((v) => v.toLowerCase().includes(term));
    });
  }, [equipmentList, equipmentSearch]);

  const sortedFilteredEquipments = useMemo(
    () =>
      [...filteredEquipments].sort((a, b) =>
        getEquipmentShortLabel(a).localeCompare(getEquipmentShortLabel(b))
      ),
    [filteredEquipments]
  );

  useEffect(() => {
    if (selectedEquipment && equipmentId) {
      setEquipmentSearch(getEquipmentShortLabel(selectedEquipment));
    }
  }, [equipmentId, selectedEquipment]);

  const handleSelectEquipment = (e: EquipmentResponseDTO) => {
    setEquipmentId(e.id);
    setEquipmentSearch(getEquipmentShortLabel(e));
    setSearchParams({ equipmentId: e.id });
    setDropdownOpen(false);
    inputRef.current?.blur();
  };

  const handleSearchChange = (value: string) => {
    setEquipmentSearch(value);
    setDropdownOpen(true);
    if (equipmentId) {
      const sel = equipmentList.find((x) => x.id === equipmentId);
      if (sel && getEquipmentShortLabel(sel) !== value) {
        setEquipmentId("");
        setSearchParams({});
      }
    }
  };

  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(ev.target as Node) &&
        inputRef.current && !inputRef.current.contains(ev.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="mb-6">
        <h3 className="text-[18px] text-foreground" style={{ fontWeight: 700 }}>
          Histórico de defeitos
        </h3>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Consulte defeitos já resolvidos por equipamento, mês e ano.
        </p>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative" ref={dropdownRef}>
              <label className="block text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                Equipamento
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={equipmentSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Busque por patrimônio, serial, hostname ou IP..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border focus:border-sky-400 text-[13px] outline-none bg-card"
                />
              </div>
              {dropdownOpen && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-60 overflow-y-auto">
                  {sortedFilteredEquipments.length === 0 ? (
                    <div className="px-3 py-4 text-[13px] text-muted-foreground text-center">
                      Nenhum equipamento encontrado
                    </div>
                  ) : (
                    <ul className="py-1">
                      {sortedFilteredEquipments.map((e: EquipmentResponseDTO) => (
                        <li key={e.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectEquipment(e)}
                            className={`w-full text-left px-3 py-2.5 text-[13px] hover:bg-muted transition-colors ${e.id === equipmentId ? "bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200" : "text-foreground"}`}
                          >
                            <span className="block font-medium">{getEquipmentShortLabel(e)}</span>
                            <span className="block text-[11px] text-muted-foreground mt-0.5">{getEquipmentDropdownSecondary(e)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                Ano
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-border focus:border-sky-400 text-[13px] outline-none bg-card"
              >
                {yearsForSelector.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                Mês
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-border focus:border-sky-400 text-[13px] outline-none bg-card"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-4">
          {!equipmentId ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-[14px] text-muted-foreground" style={{ fontWeight: 500 }}>
                Selecione um equipamento, ano e mês para ver o histórico de defeitos resolvidos.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-sky-300 border-t-primary rounded-full animate-spin" />
            </div>
          ) : defects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-[14px] text-muted-foreground" style={{ fontWeight: 500 }}>
                Nenhum defeito resolvido neste período.
              </p>
              {selectedEquipment && (
                <p className="text-[12px] text-muted-foreground mt-1">
                  {isEquipmentWithoutAsset(selectedEquipment.assetNumber, selectedEquipment.id)
                    ? "Sem patrimônio"
                    : selectedEquipment.assetNumber}{" "}
                  — {EQUIPMENT_TYPE_LABELS[selectedEquipment.type]} {selectedEquipment.brand}
                </p>
              )}
            </div>
          ) : (
            <>
              {selectedEquipment && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-sky-50 dark:bg-sky-950/40 rounded-lg border border-sky-100 dark:border-sky-800">
                  <Package className="w-4 h-4 text-sky-600" />
                  <span className="text-[13px] text-sky-800" style={{ fontWeight: 600 }}>
                    {isEquipmentWithoutAsset(selectedEquipment.assetNumber, selectedEquipment.id)
                      ? "Sem patrimônio"
                      : selectedEquipment.assetNumber}{" "}
                    · {EQUIPMENT_TYPE_LABELS[selectedEquipment.type]} {selectedEquipment.brand}
                  </span>
                  <span className="text-[12px] text-sky-600">
                    — {MONTHS.find((m) => m.value === month)?.label} / {year}
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 700 }}>
                        Descrição
                      </th>
                      <th className="px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-wider hidden sm:table-cell" style={{ fontWeight: 700 }}>
                        Registrado em
                      </th>
                      <th className="px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-wider hidden md:table-cell" style={{ fontWeight: 700 }}>
                        Por
                      </th>
                      <th className="px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 700 }}>
                        Resolvido em
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {defects.map((d: DefectResponse) => (
                      <tr key={d.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3.5 text-foreground">{d.description}</td>
                        <td className="px-4 py-3.5 text-muted-foreground hidden sm:table-cell">
                          {formatDefectDate(d.reportedAt)}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground hidden md:table-cell">
                          {d.reportedBy || "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-[12px]" style={{ fontWeight: 500 }}>
                            <CheckCircle className="w-3.5 h-3.5" />
                            {d.resolvedAt ? formatDefectDate(d.resolvedAt) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
