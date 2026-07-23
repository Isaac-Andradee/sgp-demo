import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { X, Tag, Hash, Building2, User, Wifi, Calendar, Package, AlertCircle, Plus, CheckCircle, History, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { equipmentApi } from "../api/equipment.api";
import type { EquipmentResponseDTO, DefectResponse } from "../types";
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_COLORS, normalizeEquipmentStatus, getEquipmentTypeLabel, isEquipmentWithoutAsset } from "../types";
import { toast } from "sonner";

const DEFECT_DESCRIPTION_MAX = 500;

interface Props {
  open: boolean;
  onClose: () => void;
  equipment: EquipmentResponseDTO | null;
  onEdit?: () => void;
}

function formatDefectDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EquipmentDetailsModal({ open, onClose, equipment, onEdit }: Props) {
  const queryClient = useQueryClient();
  const [defectFormOpen, setDefectFormOpen] = useState(false);
  const [defectDescription, setDefectDescription] = useState("");
  const [editingDefectId, setEditingDefectId] = useState<string | null>(null);
  const [editingDefectDescription, setEditingDefectDescription] = useState("");

  useEffect(() => {
    if (!open || !equipment) {
      setDefectFormOpen(false);
      setDefectDescription("");
      setEditingDefectId(null);
      setEditingDefectDescription("");
    }
  }, [open, equipment?.id]);

  const { data: defectsRaw = [], isLoading: defectsLoading } = useQuery({
    queryKey: ["equipment-defects-open", equipment?.id],
    queryFn: () => equipmentApi.getDefects(equipment!.id, { status: "ABERTO" }),
    enabled: open && !!equipment?.id,
  });

  const defects = useMemo(
    () => defectsRaw.filter((d: DefectResponse) => d.status === "ABERTO"),
    [defectsRaw]
  );

  const createDefectMutation = useMutation({
    mutationFn: (desc: string) =>
      equipmentApi.createDefect(equipment!.id, { description: desc.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-defects-open", equipment?.id] });
      queryClient.invalidateQueries({ queryKey: ["equipments-paged"] });
      queryClient.invalidateQueries({ queryKey: ["equipments-filter"] });
      setDefectDescription("");
      setDefectFormOpen(false);
      toast.success("Defeito registrado.");
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string } } };
      toast.error(axErr?.response?.data?.message ?? "Erro ao registrar defeito.");
    },
  });

  const updateDefectMutation = useMutation({
    mutationFn: ({ defectId, description }: { defectId: string; description: string }) =>
      equipmentApi.updateDefect(equipment!.id, defectId, { description: description.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-defects-open", equipment?.id] });
      queryClient.invalidateQueries({ queryKey: ["equipments-paged"] });
      queryClient.invalidateQueries({ queryKey: ["equipments-filter"] });
      setEditingDefectId(null);
      setEditingDefectDescription("");
      toast.success("Defeito atualizado.");
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string } } };
      toast.error(axErr?.response?.data?.message ?? "Erro ao atualizar defeito.");
    },
  });

  const resolveDefectMutation = useMutation({
    mutationFn: (defectId: string) =>
      equipmentApi.resolveDefect(equipment!.id, defectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-defects-open", equipment?.id] });
      queryClient.invalidateQueries({ queryKey: ["equipments-paged"] });
      queryClient.invalidateQueries({ queryKey: ["equipments-filter"] });
      setEditingDefectId(null);
      toast.success("Defeito marcado como resolvido.");
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string } } };
      toast.error(axErr?.response?.data?.message ?? "Erro ao marcar defeito como resolvido.");
    },
  });

  const handleSubmitDefect = () => {
    const trimmed = defectDescription.trim();
    if (!trimmed) {
      toast.error("Informe a descrição do defeito.");
      return;
    }
    if (trimmed.length > DEFECT_DESCRIPTION_MAX) {
      toast.error(`Descrição deve ter no máximo ${DEFECT_DESCRIPTION_MAX} caracteres.`);
      return;
    }
    createDefectMutation.mutate(trimmed);
  };

  if (!open || !equipment) return null;

  const hasAsset = !isEquipmentWithoutAsset(equipment.assetNumber, equipment.id);
  const safeStatus = normalizeEquipmentStatus(equipment.status) ?? (equipment.status && equipment.status in EQUIPMENT_STATUS_COLORS ? equipment.status : null);
  const statusColors = safeStatus ? EQUIPMENT_STATUS_COLORS[safeStatus] : { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-muted-foreground", border: "border-gray-200 dark:border-gray-700" };
  const statusLabel = safeStatus ? EQUIPMENT_STATUS_LABELS[safeStatus] : (equipment.status ?? "—");

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      style={{ fontFamily: "'Inter', sans-serif" }}
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0c4a6e] px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white text-[16px]" style={{ fontWeight: 600 }}>
                Detalhes do Equipamento
              </h3>
              <p className="text-white/70 text-[12px] mt-0.5">
                {getEquipmentTypeLabel(equipment.type)} · {equipment.brand}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Patrimônio e Serial */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 600 }}>
                  Patrimônio
                </label>
              </div>
              <p
                className={`text-[15px] ${hasAsset ? "text-foreground" : "text-rose-500 italic"}`}
                style={{ fontWeight: hasAsset ? 600 : 400 }}
              >
                {hasAsset ? equipment.assetNumber : "Sem Patrimônio"}
              </p>
            </div>
            <div className="bg-muted rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 600 }}>
                  Serial Number
                </label>
              </div>
              <p className="text-[15px] text-foreground" style={{ fontWeight: 500 }}>
                {equipment.serialNumber || <span className="text-muted-foreground">Não informado</span>}
              </p>
            </div>
          </div>

          {/* Descrição */}
          {equipment.description && (
            <div className="bg-sky-50 dark:bg-sky-950/40 rounded-xl p-4 border border-sky-100 dark:border-sky-800">
              <label className="text-[11px] text-sky-700 dark:text-sky-300 uppercase tracking-wider mb-2 block" style={{ fontWeight: 600 }}>
                Descrição Detalhada
              </label>
              <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
                {equipment.description}
              </p>
            </div>
          )}

          {/* Tipo, Marca e Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted rounded-xl p-4 border border-border">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block" style={{ fontWeight: 600 }}>
                Tipo
              </label>
              <p className="text-[14px] text-foreground" style={{ fontWeight: 500 }}>
                {getEquipmentTypeLabel(equipment.type)}
              </p>
            </div>
            <div className="bg-muted rounded-xl p-4 border border-border">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block" style={{ fontWeight: 600 }}>
                Marca
              </label>
              <p className="text-[14px] text-foreground" style={{ fontWeight: 500 }}>
                {equipment.brand}
              </p>
            </div>
            <div className="bg-muted rounded-xl p-4 border border-border">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block" style={{ fontWeight: 600 }}>
                Status
              </label>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}
                style={{ fontWeight: 600 }}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Setor e Responsável */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 600 }}>
                  Setor Atual
                </label>
              </div>
              <p className="text-[14px] text-foreground" style={{ fontWeight: 500 }}>
                {equipment.currentSector.acronym}
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {equipment.currentSector.fullName}
              </p>
            </div>
            {equipment.equipmentUser && (
              <div className="bg-muted rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 600 }}>
                    Responsável
                  </label>
                </div>
                <p className="text-[14px] text-foreground" style={{ fontWeight: 500 }}>
                  {equipment.equipmentUser}
                </p>
              </div>
            )}
          </div>

          {/* Informações de Rede */}
          {(equipment.hostname || equipment.ipAddress) && (
            <div className="bg-sky-50 rounded-xl p-4 border border-sky-100">
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="w-4 h-4 text-sky-600" />
                <label className="text-[11px] text-sky-700 uppercase tracking-wider" style={{ fontWeight: 600 }}>
                  Informações de Rede
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {equipment.hostname && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Hostname</p>
                    <p className="text-[13px] text-foreground font-mono" style={{ fontWeight: 500 }}>
                      {equipment.hostname}
                    </p>
                  </div>
                )}
                {equipment.ipAddress && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Endereço IP</p>
                    <p className="text-[13px] text-foreground font-mono" style={{ fontWeight: 500 }}>
                      {equipment.ipAddress}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Defeitos em aberto (histórico resolvido fica em /historico-defeitos) */}
          <div className="bg-amber-50/80 dark:bg-amber-950/40 rounded-xl p-4 border border-amber-100 dark:border-amber-800/60">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <label className="text-[11px] text-amber-800 dark:text-amber-200 uppercase tracking-wider" style={{ fontWeight: 600 }}>
                  Defeitos em aberto
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/historico-defeitos?equipmentId=${equipment.id}`}
                  className="flex items-center gap-1.5 text-[12px] text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 px-2.5 py-1.5 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <History className="w-3.5 h-3.5" />
                  Ver histórico
                </Link>
                <button
                  type="button"
                  onClick={() => setDefectFormOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-2.5 py-1.5 rounded-lg transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {defectFormOpen ? "Cancelar" : "Registrar defeito"}
                </button>
              </div>
            </div>

            {defectFormOpen && (
              <div className="mb-4 p-3 bg-card dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-700/60">
                <textarea
                  value={defectDescription}
                  onChange={(e) => setDefectDescription(e.target.value.slice(0, DEFECT_DESCRIPTION_MAX))}
                  placeholder="Descreva o defeito (obrigatório, máx. 500 caracteres)"
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px] bg-background text-foreground placeholder:text-muted-foreground focus:border-amber-400 dark:focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 outline-none resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground">
                    {defectDescription.length}/{DEFECT_DESCRIPTION_MAX}
                  </span>
                  <button
                    type="button"
                    onClick={handleSubmitDefect}
                    disabled={createDefectMutation.isPending || !defectDescription.trim()}
                    className="px-3 py-1.5 bg-amber-600 dark:bg-amber-600 hover:bg-amber-700 dark:hover:bg-amber-500 disabled:opacity-50 text-white text-[12px] rounded-lg transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    {createDefectMutation.isPending ? "Salvando..." : "Salvar defeito"}
                  </button>
                </div>
              </div>
            )}

            {defectsLoading ? (
              <p className="text-[13px] text-muted-foreground">Carregando...</p>
            ) : defects.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Nenhum defeito em aberto.</p>
            ) : (
              <ul className="space-y-3">
                {defects.map((d: DefectResponse) => (
                  <li
                    key={d.id}
                    className="bg-card dark:bg-amber-950/20 rounded-lg border border-amber-200/80 dark:border-amber-700/50 p-3 text-[13px]"
                  >
                    {editingDefectId === d.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingDefectDescription}
                          onChange={(e) => setEditingDefectDescription(e.target.value.slice(0, DEFECT_DESCRIPTION_MAX))}
                          rows={3}
                          className="w-full px-3 py-2 border border-border rounded-lg text-[13px] bg-background text-foreground placeholder:text-muted-foreground focus:border-amber-400 dark:focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 outline-none resize-none"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">
                            {editingDefectDescription.length}/{DEFECT_DESCRIPTION_MAX}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setEditingDefectId(null); setEditingDefectDescription(""); }}
                              className="px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-muted rounded-lg"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const trimmed = editingDefectDescription.trim();
                                if (!trimmed) {
                                  toast.error("Informe a descrição.");
                                  return;
                                }
                                if (trimmed.length > DEFECT_DESCRIPTION_MAX) {
                                  toast.error(`Máximo ${DEFECT_DESCRIPTION_MAX} caracteres.`);
                                  return;
                                }
                                updateDefectMutation.mutate({ defectId: d.id, description: trimmed });
                              }}
                              disabled={updateDefectMutation.isPending || !editingDefectDescription.trim()}
                              className="px-2.5 py-1.5 bg-amber-600 dark:bg-amber-600 hover:bg-amber-700 dark:hover:bg-amber-500 disabled:opacity-50 text-white text-[12px] rounded-lg"
                              style={{ fontWeight: 600 }}
                            >
                              {updateDefectMutation.isPending ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-foreground mb-1.5">{d.description}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{formatDefectDate(d.reportedAt)}</span>
                          {d.reportedBy && <span>por {d.reportedBy}</span>}
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDefectId(d.id);
                              setEditingDefectDescription(d.description);
                            }}
                            disabled={resolveDefectMutation.isPending || !!editingDefectId}
                            className="flex items-center gap-1 text-[12px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium disabled:opacity-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => resolveDefectMutation.mutate(d.id)}
                            disabled={resolveDefectMutation.isPending || !!editingDefectId}
                            className="flex items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Marcar como resolvido
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Data de Cadastro */}
          <div className="bg-muted rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 600 }}>
                Data de Cadastro
              </label>
            </div>
            <p className="text-[14px] text-foreground" style={{ fontWeight: 500 }}>
              {new Date(equipment.createdAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg text-[13px] transition-colors"
            style={{ fontWeight: 500 }}
          >
            Fechar
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-5 py-2.5 bg-primary hover:bg-[#075985] text-white rounded-lg text-[13px] shadow-sm transition-all flex items-center gap-2"
              style={{ fontWeight: 600 }}
            >
              Editar Equipamento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
