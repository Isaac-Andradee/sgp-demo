import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Building2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sectorApi } from "../api/sector.api";
import type { SectorResponseDTO } from "../types";
import { usePermissions } from "../contexts/AuthContext";
import { toast } from "sonner";

const ACRONYM_REGEX = /^[A-Z0-9-]+$/;

function validateAcronym(value: string): string | null {
  const t = value.trim().toUpperCase();
  if (!t) return "Sigla obrigatória";
  if (t.length < 2 || t.length > 20) return "Sigla deve ter entre 2 e 20 caracteres";
  if (!ACRONYM_REGEX.test(t)) return "Sigla deve conter apenas letras maiúsculas, números e hífen";
  return null;
}

function validateSectorFullName(value: string): string | null {
  if (!value.trim()) return "Nome obrigatório";
  if (value.trim().length < 3) return "Nome deve ter pelo menos 3 caracteres";
  return null;
}

function SectorModal({
  open,
  onClose,
  onSaved,
  sector,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  sector: SectorResponseDTO | null;
}) {
  const [acronym, setAcronym] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (sector) {
      setAcronym(sector.acronym);
      setFullName(sector.fullName);
    } else {
      setAcronym("");
      setFullName("");
    }
    setErrors({});
  }, [sector, open]);

  const createMutation = useMutation({
    mutationFn: sectorApi.create,
    onSuccess: () => { toast.success("Setor criado com sucesso."); onSaved(); },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string; validationErrors?: Record<string, string> } } };
      if (axErr?.response?.data?.validationErrors) setErrors(axErr.response.data.validationErrors);
      else toast.error(axErr?.response?.data?.message ?? "Erro ao criar setor.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { acronym: string; fullName: string } }) =>
      sectorApi.update(id, data),
    onSuccess: () => { toast.success("Setor atualizado com sucesso."); onSaved(); },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string; validationErrors?: Record<string, string> } } };
      if (axErr?.response?.data?.validationErrors) setErrors(axErr.response.data.validationErrors);
      else toast.error(axErr?.response?.data?.message ?? "Erro ao atualizar setor.");
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const validate = () => {
    const e: Record<string, string> = {};
    const trimAcronym = acronym.trim().toUpperCase();
    if (!trimAcronym) e.acronym = "Sigla obrigatória";
    else if (trimAcronym.length < 2 || trimAcronym.length > 20) e.acronym = "Sigla deve ter entre 2 e 20 caracteres";
    else if (!ACRONYM_REGEX.test(trimAcronym)) e.acronym = "Sigla deve conter apenas letras maiúsculas, números e hífen";
    if (!fullName.trim()) e.fullName = "Nome obrigatório";
    else if (fullName.trim().length < 3) e.fullName = "Nome deve ter pelo menos 3 caracteres";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const payload = { acronym: acronym.trim().toUpperCase(), fullName: fullName.trim() };
    if (sector) updateMutation.mutate({ id: sector.id, data: payload });
    else createMutation.mutate(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border">
        <div className="bg-[#0c4a6e] px-6 py-4 flex justify-between items-center">
          <h3 className="text-white text-[16px]" style={{ fontWeight: 600 }}>
            {sector ? "Editar Setor" : "Novo Setor"}
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              Sigla (Ex: TIC, GAB)
            </label>
            <input
              value={acronym}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                setAcronym(v);
                setErrors((p) => { const n = { ...p }; const err = validateAcronym(v); if (err) n.acronym = err; else delete n.acronym; return n; });
              }}
              placeholder="Sigla do setor"
              maxLength={20}
              className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all uppercase ${errors.acronym ? "border-red-400" : "border-border"}`}
            />
            {errors.acronym && <p className="text-[11px] text-red-500 mt-1">{errors.acronym}</p>}
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              Nome Completo
            </label>
            <input
              value={fullName}
              onChange={(e) => {
                const v = e.target.value;
                setFullName(v);
                setErrors((p) => { const n = { ...p }; const err = validateSectorFullName(v); if (err) n.fullName = err; else delete n.fullName; return n; });
              }}
              placeholder="Nome completo do setor"
              className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all ${errors.fullName ? "border-red-400" : "border-border"}`}
            />
            {errors.fullName && <p className="text-[11px] text-red-500 mt-1">{errors.fullName}</p>}
          </div>
        </div>
        <div className="px-6 py-4 bg-muted border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg text-[13px] transition-colors"
            style={{ fontWeight: 500 }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2.5 bg-primary hover:bg-[#075985] text-white rounded-lg text-[13px] shadow-sm transition-all flex items-center gap-2 disabled:opacity-60"
            style={{ fontWeight: 600 }}
          >
            {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {sector ? "Salvar Alteracoes" : "Criar Setor"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SetoresPage() {
  const queryClient = useQueryClient();
  const { canManageSectors } = usePermissions();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<SectorResponseDTO | null>(null);

  const { data: setores = [], isLoading } = useQuery({
    queryKey: ["sectors"],
    queryFn: sectorApi.list,
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: sectorApi.remove,
    onSuccess: () => {
      toast.success("Setor removido com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string } } };
      toast.error(axErr?.response?.data?.message ?? "Erro ao remover setor.");
    },
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["sectors"] });
    setModalOpen(false);
    setEditingSector(null);
  };

  const handleEdit = (sector: SectorResponseDTO) => {
    setEditingSector(sector);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Deseja realmente remover este setor?")) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-[18px] text-foreground" style={{ fontWeight: 700 }}>
            Gestao de Setores
          </h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Cadastre e gerencie os setores da unidade
          </p>
        </div>
        {canManageSectors && (
          <button
            onClick={() => { setEditingSector(null); setModalOpen(true); }}
            className="bg-primary hover:bg-[#075985] text-white px-4 py-2.5 rounded-lg text-[13px] shadow-lg shadow-sky-600/10 transition-all duration-200 flex items-center gap-2"
            style={{ fontWeight: 600 }}
          >
            <Plus className="w-4 h-4" />
            Novo Setor
          </button>
        )}
      </div>

      {/* Setores grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-5 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-muted mb-3" />
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {setores.map((setor) => (
            <div
              key={setor.id}
              className="bg-card rounded-xl border border-border p-5 hover:shadow-md hover:border-sky-200 dark:hover:border-sky-600 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                {canManageSectors && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => handleEdit(setor)}
                      className="p-2 text-muted-foreground hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(setor.id)}
                      className="p-2 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <h4 className="text-[16px] text-foreground" style={{ fontWeight: 700 }}>
                {setor.acronym}
              </h4>
              <p className="text-[12px] text-muted-foreground mt-0.5">{setor.fullName}</p>
            </div>
          ))}

          {canManageSectors && (
            <button
              onClick={() => { setEditingSector(null); setModalOpen(true); }}
              className="bg-muted rounded-xl border-2 border-dashed border-border p-5 hover:border-sky-300 hover:bg-sky-50/30 dark:hover:bg-sky-950/30 transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-[130px]"
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Plus className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>
                Adicionar Setor
              </span>
            </button>
          )}
        </div>
      )}

      <SectorModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingSector(null); }}
        onSaved={handleSaved}
        sector={editingSector}
      />
    </div>
  );
}
