import { useState, useEffect } from "react";
import { Link } from "react-router";
import { X, Wifi, Tag, Truck } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { equipmentApi } from "../api/equipment.api";
import type { EquipmentResponseDTO, SectorResponseDTO, EquipmentType, EquipmentStatus, CreateEquipmentDTO } from "../types";
import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_STATUS_LABELS,
  shouldShowUserField,
  isEquipmentWithoutAsset,
} from "../types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  equipment: EquipmentResponseDTO | null;
  sectors: SectorResponseDTO[];
}

const EQUIPMENT_TYPES: EquipmentType[] = ["PC", "MONITOR", "TECLADO", "NOTEBOOK", "IMPRESSORA", "ROTEADOR", "SWITCH", "SERVIDOR", "ESTABILIZADOR", "NOBREAK", "ROTULADORA", "ARMAZENAMENTO", "OUTROS"];
const EQUIPMENT_STATUSES: EquipmentStatus[] = ["DISPONIVEL", "INSERVIVEL", "PROVISORIO", "EM_USO", "MANUTENCAO", "BAIXADO", "EXCLUIDO"];

/** Tipos que exibem e enviam hostname / IP (armazenamento não inclui rede). */
function isNetworkEquipmentType(t: EquipmentType | ""): boolean {
  return (
    t === "PC" ||
    t === "NOTEBOOK" ||
    t === "SERVIDOR" ||
    t === "ROTEADOR" ||
    t === "IMPRESSORA"
  );
}

type FormState = {
  assetNumber: string;
  serialNumber: string;
  brand: string;
  description: string;
  type: EquipmentType | "";
  status: EquipmentStatus | "";
  sectorId: string;
  equipmentUser: string;
  hostname: string;
  ipAddress: string;
  networkMode: "" | "DHCP" | "FIXO";
};

const emptyForm: FormState = {
  assetNumber: "",
  serialNumber: "",
  brand: "",
  description: "",
  type: "",
  status: "",
  sectorId: "",
  equipmentUser: "",
  hostname: "",
  ipAddress: "",
  networkMode: "",
};

function validateAssetNumber(value: string, noAsset: boolean): string | null {
  if (noAsset) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return "Patrimônio obrigatório (ou marque 'Sem etiqueta')";
  if (digits.length > 7) return "Patrimônio deve ter no máximo 7 dígitos";
  return null;
}
function validateBrand(value: string): string | null {
  if (!value.trim()) return "Marca obrigatória";
  return null;
}
function validateType(value: FormState["type"]): string | null {
  if (!value) return "Selecione o tipo de equipamento";
  return null;
}
function validateStatus(value: FormState["status"]): string | null {
  if (!value) return "Selecione o status";
  return null;
}
function validateSectorId(value: string, isEditing: boolean): string | null {
  if (isEditing) return null;
  if (!value) return "Selecione o setor";
  return null;
}
function validateIpAddress(ipValue: string, networkMode: FormState["networkMode"]): string | null {
  if (networkMode !== "FIXO" || !ipValue) return null;
  const v = ipValue.trim();
  if (!v) return "Digite os últimos dígitos do IP (ex: 10, 100, 255)";
  if (!/^\d{1,3}$/.test(v)) return "Digite apenas números (1 a 3 dígitos)";
  const num = parseInt(v, 10);
  if (num < 1 || num > 255) return "O valor deve estar entre 1 e 255";
  return null;
}
function validateHostname(value: string): string | null {
  if (!value) return null;
  if (/[^a-zA-Z0-9.-]/.test(value)) return "Hostname inválido (apenas letras, números, ponto e hífen)";
  return null;
}

/** Responsável: opcional; se preenchido, apenas letras (Unicode), espaços, hífens e apóstrofos; máx. 100 caracteres. */
const EQUIPMENT_USER_REGEX = /^[\p{L}\s\-']+$/u;
const EQUIPMENT_USER_MAX = 100;

function validateEquipmentUser(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  if (t.length > EQUIPMENT_USER_MAX) return "Máx. 100 caracteres.";
  if (!EQUIPMENT_USER_REGEX.test(t)) return "Nome deve conter apenas letras, espaços, hífens ou apóstrofos (ex.: Maria da Silva, Jean-Pierre).";
  return null;
}

function toTitleCase(s: string): string {
  return s.trim().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export function EquipmentModal({ open, onClose, onSaved, equipment, sectors }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [noAsset, setNoAsset] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assetInputValue, setAssetInputValue] = useState("");

  // Opcional: carregar marcas a partir do backend, caso o endpoint exista.
  const { data: brands } = useQuery({
    queryKey: ["equipment-brands"],
    queryFn: async () => {
      // Backend deve expor GET /equipments/brands retornando string[]
      const response = await equipmentApi.getBrands?.();
      return response ?? [];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (equipment) {
      const ip = equipment.ipAddress ?? "";
      let networkMode: FormState["networkMode"] = "";
      let ipValue = "";

      if (ip === "DHCP") {
        networkMode = "DHCP";
        ipValue = "DHCP";
      } else if (ip.startsWith("10.190.110.")) {
        networkMode = "FIXO";
        // Extrai apenas os últimos dígitos após "10.190.110."
        ipValue = ip.replace("10.190.110.", "");
      } else if (ip) {
        // IP customizado (não DHCP nem rede fixa)
        networkMode = "";
        ipValue = ip;
      }

      const assetNum = isEquipmentWithoutAsset(equipment.assetNumber, equipment.id) ? "" : equipment.assetNumber;
      setForm({
        assetNumber: assetNum,
        serialNumber: equipment.serialNumber ?? "",
        brand: equipment.brand,
        description: equipment.description ?? "",
        type: equipment.type,
        status: equipment.status,
        sectorId: equipment.currentSector.id,
        equipmentUser: equipment.equipmentUser ?? "",
        hostname: equipment.hostname ?? "",
        ipAddress: ipValue ?? "",
        networkMode: networkMode ?? "",
      });
      setNoAsset(isEquipmentWithoutAsset(equipment.assetNumber, equipment.id));
      setAssetInputValue(assetNum.replace(/\D/g, ""));
    } else {
      setForm({ ...emptyForm });
      setNoAsset(false);
      setAssetInputValue("");
    }
    setErrors({});
  }, [equipment, open, sectors]);

  const isEditing = !!equipment;
  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      setErrors((errPrev) => {
        const e = { ...errPrev };
        let err: string | null = null;
        if (field === "assetNumber") err = validateAssetNumber(String(value).replace(/\D/g, ""), noAsset);
        else if (field === "brand") err = validateBrand(String(value));
        else if (field === "type") err = validateType(value as FormState["type"]);
        else if (field === "status") err = validateStatus(value as FormState["status"]);
        else if (field === "sectorId") err = validateSectorId(String(value), isEditing);
        else if (field === "ipAddress") err = validateIpAddress(String(value), next.networkMode);
        else if (field === "hostname") err = validateHostname(String(value));
        else if (field === "equipmentUser") err = validateEquipmentUser(String(value));
        if (err) e[field] = err; else delete e[field];
        if (field === "networkMode") {
          const ipErr = validateIpAddress(next.ipAddress, value as FormState["networkMode"]);
          if (ipErr) e.ipAddress = ipErr; else delete e.ipAddress;
        }
        return e;
      });
      return next;
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateEquipmentDTO) => equipmentApi.create(data),
    onSuccess: () => {
      toast.success("Equipamento cadastrado com sucesso.");
      onSaved();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { status?: number; data?: { message?: string; validationErrors?: Record<string, string> } } };
      const msg = axErr?.response?.data?.message ?? "";
      const valErrors = axErr?.response?.data?.validationErrors;
      if (valErrors) {
        setErrors(valErrors);
      } else if (msg && (msg.includes("patrimônio") || msg.includes("patrimonio") || msg.toLowerCase().includes("asset"))) {
        setErrors((prev) => ({ ...prev, assetNumber: msg }));
        toast.error(msg);
      } else if (msg && (msg.includes("Nome deve conter") || msg.includes("letras, espaços"))) {
        setErrors((prev) => ({ ...prev, equipmentUser: msg }));
        toast.error(msg);
      } else {
        toast.error(msg || "Erro ao cadastrar equipamento.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateEquipmentDTO }) =>
      equipmentApi.update(id, data),
    onSuccess: () => {
      toast.success("Equipamento atualizado com sucesso.");
      onSaved();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string; validationErrors?: Record<string, string> } } };
      const msg = axErr?.response?.data?.message ?? "";
      const valErrors = axErr?.response?.data?.validationErrors;
      if (valErrors) setErrors(valErrors);
      else if (msg && (msg.includes("Nome deve conter") || msg.includes("letras, espaços"))) {
        setErrors((prev) => ({ ...prev, equipmentUser: msg }));
        toast.error(msg);
      } else {
        toast.error(msg || "Erro ao atualizar equipamento.");
      }
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!noAsset) {
      const digitsOnly = form.assetNumber.replace(/\D/g, "");
      if (!digitsOnly) {
        e.assetNumber = "Patrimônio obrigatório (ou marque 'Sem etiqueta')";
      } else if (digitsOnly.length > 7) {
        e.assetNumber = "Patrimônio deve ter no máximo 7 dígitos";
      }
    }
    if (!form.brand.trim()) e.brand = "Marca obrigatória";
    if (!form.type) e.type = "Selecione o tipo de equipamento";
    if (!form.status) e.status = "Selecione o status";
    if (!equipment && !form.sectorId) e.sectorId = "Selecione o setor";
    if (isNetworkEquipmentType(form.type)) {
      if (form.networkMode === "FIXO" && form.ipAddress) {
        const ipValue = form.ipAddress.trim();
        if (!ipValue) {
          e.ipAddress = "Digite os últimos dígitos do IP (ex: 10, 100, 255)";
        } else if (!/^\d{1,3}$/.test(ipValue)) {
          e.ipAddress = "Digite apenas números (1 a 3 dígitos)";
        } else {
          const num = parseInt(ipValue, 10);
          if (num < 1 || num > 255) {
            e.ipAddress = "O valor deve estar entre 1 e 255";
          }
        }
      }
      if (form.hostname && /[^a-zA-Z0-9.-]/.test(form.hostname))
        e.hostname = "Hostname inválido (apenas letras, números, ponto e hífen)";
    }
    if (showUser && form.equipmentUser.trim()) {
      const euErr = validateEquipmentUser(form.equipmentUser);
      if (euErr) e.equipmentUser = euErr;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    // Normaliza patrimônio para 7 dígitos numéricos quando houver
    const rawAssetDigits = form.assetNumber.replace(/\D/g, "");
    const normalizedAsset = noAsset
      ? "TEMP-"
      : rawAssetDigits
        ? rawAssetDigits.padStart(7, "0")
        : "";

    const includeNetwork = isNetworkEquipmentType(form.type);

    // Trata IP conforme modo de rede (somente tipos com rede)
    let ipToSend: string | undefined;
    if (includeNetwork) {
      if (form.networkMode === "DHCP") {
        ipToSend = "DHCP";
      } else if (form.networkMode === "FIXO" && form.ipAddress.trim()) {
        const raw = form.ipAddress.trim();
        const num = /^\d+$/.test(raw) ? String(parseInt(raw, 10)) : raw;
        ipToSend = `10.190.110.${num}`;
      } else if (form.ipAddress.trim()) {
        ipToSend = form.ipAddress.trim();
      } else {
        ipToSend = undefined;
      }
    } else {
      ipToSend = undefined;
    }

    const payload: CreateEquipmentDTO = {
      assetNumber: normalizedAsset,
      serialNumber: form.serialNumber.trim() || undefined,
      brand: form.brand.trim(),
      description: form.description.trim() || undefined,
      type: form.type as EquipmentType,
      status: form.status as EquipmentStatus,
      sectorId: equipment ? equipment.currentSector.id : form.sectorId,
      equipmentUser: form.status ? shouldShowUserField(form.status as EquipmentStatus) ? (form.equipmentUser.trim() ? toTitleCase(form.equipmentUser) : undefined) : undefined : undefined,
      hostname: includeNetwork ? form.hostname.trim() || undefined : undefined,
      ipAddress: includeNetwork ? ipToSend : undefined,
    };

    if (equipment) {
      updateMutation.mutate({ id: equipment.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (!open) return null;

  const showUser = form.status ? shouldShowUserField(form.status as EquipmentStatus) : false;
  const shouldShowNetwork = isNetworkEquipmentType(form.type);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-border">
        {/* Header */}
        <div className="bg-[#0c4a6e] px-6 py-4 flex justify-between items-center">
          <h3 className="text-white text-[16px]" style={{ fontWeight: 600 }}>
            {isEditing ? "Editar Equipamento" : "Novo Equipamento"}
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* No asset tag */}
          <label className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 cursor-pointer hover:bg-amber-50/80 dark:hover:bg-amber-950/50 transition-colors">
            <input
              type="checkbox"
              checked={noAsset}
              onChange={(e) => {
                const checked = e.target.checked;
                setNoAsset(checked);
                setErrors((prev) => {
                  const n = { ...prev };
                  const err = validateAssetNumber(form.assetNumber.replace(/\D/g, ""), checked);
                  if (err) n.assetNumber = err; else delete n.assetNumber;
                  return n;
                });
              }}
              className="mt-0.5 w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <span className="text-[13px] text-amber-800 dark:text-amber-200" style={{ fontWeight: 600 }}>
                Item sem etiqueta patrimonial?
              </span>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                Voce pode definir o status do equipamento abaixo.
              </p>
            </div>
          </label>

          {/* Patrimônio & Serial */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                <Tag className="w-3 h-3 inline mr-1" />
                Patrimonio <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={noAsset ? "Sem Patrimonio" : assetInputValue}
                onChange={(e) => {
                  if (noAsset) return;
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 7);
                  setAssetInputValue(digits);
                  handleChange("assetNumber", digits);
                }}
                disabled={noAsset}
                placeholder={noAsset ? "Sem Patrimonio" : "Digite 7 dígitos (ex: 1234567)"}
                className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] bg-background transition-all disabled:bg-muted disabled:text-muted-foreground ${errors.assetNumber ? "border-red-400" : "border-border"
                  }`}
              />
              {!noAsset && assetInputValue.length > 0 && assetInputValue.length < 7 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Será salvo como: <span className="font-mono">{assetInputValue.padStart(7, "0")}</span>
                </p>
              )}
              {errors.assetNumber && <p className="text-[11px] text-red-500 mt-1">{errors.assetNumber}</p>}
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                Serial Number
              </label>
              <input
                type="text"
                value={form.serialNumber}
                maxLength={50}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 50);
                  handleChange("serialNumber", sanitized);
                }}
                placeholder="Apenas letras e numeros (max. 50)"
                className="w-full px-3 py-2.5 border border-border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] bg-background transition-all"
              />
            </div>
          </div>

          {/* Marca */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              Marca <span className="text-red-500">*</span>
            </label>
            {brands && brands.length > 0 ? (
              <select
                value={form.brand}
                onChange={(e) => handleChange("brand", e.target.value)}
                className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 text-[13px] outline-none bg-background ${errors.brand ? "border-red-400" : "border-border"
                  }`}
              >
                <option value="">Selecione a marca</option>
                {[...(brands ?? [])]
                  .sort((a, b) => a.localeCompare(b))
                  .map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                value={form.brand}
                onChange={(e) => handleChange("brand", e.target.value)}
                placeholder="Ex: Dell, Lenovo, HP..."
                className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] bg-background transition-all ${errors.brand ? "border-red-400" : "border-border"
                  }`}
              />
            )}
            {errors.brand && <p className="text-[11px] text-red-500 mt-1">{errors.brand}</p>}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              Descricao Detalhada
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={3}
              placeholder="Especificacoes do equipamento..."
              className="w-full px-3 py-2.5 border border-border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] bg-background resize-none transition-all"
            />
          </div>

          {/* Tipo & Setor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                Tipo de Equipamento <span className="text-red-500">*</span>
              </label>
              <select
                value={form.type}
                onChange={(e) => handleChange("type", e.target.value as EquipmentType | "")}
                className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 text-[13px] outline-none bg-background ${errors.type ? "border-red-400" : "border-border"}`}
              >
                <option value="">Selecione o tipo</option>
                {[...EQUIPMENT_TYPES]
                  .sort((a, b) => EQUIPMENT_TYPE_LABELS[a].localeCompare(EQUIPMENT_TYPE_LABELS[b]))
                  .map((t) => (
                    <option key={t} value={t}>{EQUIPMENT_TYPE_LABELS[t]}</option>
                  ))}
              </select>
              {errors.type && <p className="text-[11px] text-red-500 mt-1">{errors.type}</p>}
            </div>
            <div>
              {isEditing ? (
                <>
                  <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                    Setor atual
                  </label>
                  <div className="w-full px-3 py-2.5 border border-border rounded-lg bg-muted text-foreground text-[13px]">
                    {equipment.currentSector.acronym} — {equipment.currentSector.fullName}
                  </div>
                  <div className="mt-2 p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800">
                    <p className="text-[11px] text-sky-800 dark:text-sky-200 flex items-start gap-2" style={{ fontWeight: 500 }}>
                      <Truck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                        Para alterar o setor deste equipamento, use a ferramenta de{" "}
                        <Link
                          to="/movimentacao"
                          state={{ equipment }}
                          className="text-sky-600 dark:text-sky-400 underline hover:text-sky-700 dark:hover:text-sky-300"
                          onClick={onClose}
                        >
                          Transferência em Movimentação
                        </Link>.
                      </span>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                    Setor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.sectorId}
                    onChange={(e) => handleChange("sectorId", e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 text-[13px] outline-none bg-background ${errors.sectorId ? "border-red-400" : "border-border"}`}
                  >
                    <option value="">Selecione o setor</option>
                    {[...sectors]
                      .sort((a, b) => `${a.acronym} - ${a.fullName}`.localeCompare(`${b.acronym} - ${b.fullName}`))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.acronym} - {s.fullName}
                        </option>
                      ))}
                  </select>
                  {errors.sectorId && <p className="text-[11px] text-red-500 mt-1">{errors.sectorId}</p>}
                </>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              Status <span className="text-red-500">*</span>
            </label>
            <select
              value={form.status}
              onChange={(e) => handleChange("status", e.target.value as EquipmentStatus | "")}
              className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 text-[13px] outline-none bg-background ${errors.status ? "border-red-400" : "border-border"}`}
            >
              <option value="">Selecione o status</option>
              {[...EQUIPMENT_STATUSES]
                .sort((a, b) => EQUIPMENT_STATUS_LABELS[a].localeCompare(EQUIPMENT_STATUS_LABELS[b]))
                .map((s) => (
                  <option key={s} value={s}>{EQUIPMENT_STATUS_LABELS[s]}</option>
                ))}
            </select>
            {errors.status && <p className="text-[11px] text-red-500 mt-1">{errors.status}</p>}
          </div>

          {/* Responsável */}
          {showUser && (
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                Responsavel
              </label>
              <input
                value={form.equipmentUser}
                onChange={(e) => handleChange("equipmentUser", e.target.value)}
                onBlur={() => {
                  if (form.equipmentUser.trim()) {
                    const formatted = toTitleCase(form.equipmentUser);
                    if (formatted !== form.equipmentUser) {
                      setForm((prev) => ({ ...prev, equipmentUser: formatted }));
                      setErrors((prev) => {
                        const n = { ...prev };
                        const err = validateEquipmentUser(formatted);
                        if (err) n.equipmentUser = err; else delete n.equipmentUser;
                        return n;
                      });
                    }
                  }
                }}
                placeholder="Ex.: Maria da Silva, Jean-Pierre"
                maxLength={EQUIPMENT_USER_MAX}
                className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] bg-background transition-all ${errors.equipmentUser ? "border-red-400" : "border-border"}`}
              />
              {errors.equipmentUser && <p className="text-[11px] text-red-500 mt-1">{errors.equipmentUser}</p>}
              <p className="text-[11px] text-muted-foreground mt-0.5">Apenas letras, espaços, hífens ou apóstrofos (máx. 100 caracteres).</p>
            </div>
          )}

          {/* Rede */}
          {shouldShowNetwork && (
            <div className="bg-sky-50 dark:bg-sky-950/40 p-4 rounded-xl border border-sky-100 dark:border-sky-800">
              <p className="text-[11px] text-sky-700 dark:text-sky-300 uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ fontWeight: 700 }}>
                <Wifi className="w-3.5 h-3.5" />
                Informacoes de Rede (Opcional)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <input
                    value={form.hostname ?? ""}
                    onChange={(e) => handleChange("hostname", e.target.value)}
                    placeholder="Hostname"
                    className={`w-full px-3 py-2.5 border rounded-lg outline-none text-[13px] focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 bg-background transition-all ${errors.hostname ? "border-red-400" : "border-border"}`}
                  />
                  {errors.hostname && <p className="text-[11px] text-red-500 mt-1">{errors.hostname}</p>}
                </div>
                <div className="space-y-2">
                  <select
                    value={form.networkMode ?? ""}
                    onChange={(e) => {
                      const mode = e.target.value as FormState["networkMode"];
                      handleChange("networkMode", mode);
                      if (mode === "FIXO") {
                        handleChange("ipAddress", "");
                      } else if (mode === "DHCP") {
                        handleChange("ipAddress", "DHCP");
                      } else {
                        handleChange("ipAddress", "");
                      }
                    }}
                    className="w-full px-3 py-2.5 border border-border rounded-lg outline-none text-[13px] bg-background focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10"
                  >
                    <option value="">Selecione o modo de rede</option>
                    <option value="DHCP">DHCP (automático)</option>
                    <option value="FIXO">IP fixo (10.190.110.xx)</option>
                  </select>
                  {form.networkMode === "FIXO" ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground pointer-events-none">
                        10.190.110.
                      </span>
                      <input
                        type="text"
                        value={form.ipAddress ?? ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                          handleChange("ipAddress", digits);
                        }}
                        placeholder="xx"
                        maxLength={3}
                        className={`w-full pl-[100px] pr-3 py-2.5 border rounded-lg outline-none text-[13px] focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 bg-background transition-all ${errors.ipAddress ? "border-red-400" : "border-border"
                          }`}
                      />
                    </div>
                  ) : form.networkMode === "DHCP" ? (
                    <input
                      value="DHCP"
                      disabled
                      className="w-full px-3 py-2.5 border border-border rounded-lg outline-none text-[13px] bg-muted text-muted-foreground cursor-not-allowed"
                    />
                  ) : (
                    <input
                      disabled
                      placeholder="Selecione o modo de rede"
                      className="w-full px-3 py-2.5 border border-border rounded-lg outline-none text-[13px] bg-muted text-muted-foreground cursor-not-allowed"
                    />
                  )}
                  {errors.ipAddress && <p className="text-[11px] text-red-500 mt-1">{errors.ipAddress}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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
            {isEditing ? "Salvar Alteracoes" : "Cadastrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
