import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Terminal,
  Power,
  PowerOff,
  RefreshCw,
  ShieldCheck,
  Code2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Users,
  Wrench,
  Megaphone,
  Save,
} from "lucide-react";
import { devApi, type SystemSettings } from "../api/dev.api";
import { ConfirmDialog } from "./confirm-dialog";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { usePageTitle } from "../hooks/usePageTitle";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "1.0.0";
const API_URL     = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081/api";

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>{label}</span>
      <span className={`text-[12px] text-foreground ${mono ? "font-mono bg-muted px-2 py-0.5 rounded" : ""}`} style={{ fontWeight: mono ? 400 : 600 }}>
        {value}
      </span>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? "bg-rose-500" : "bg-emerald-500"}`} />
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] text-foreground mb-1.5" style={{ fontWeight: 600 }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Central de Manutenção — personalização da tela de manutenção + aviso programado.
 * Recebe as configurações já carregadas e inicializa o formulário a partir delas
 * (montada só quando `settings` existe, evita sincronização via efeito).
 */
function MaintenanceCentral({ settings }: { settings: SystemSettings }) {
  const queryClient = useQueryClient();

  const [mMessage, setMMessage] = useState(settings.maintenanceMessage ?? "");
  const [mWindowStart, setMWindowStart] = useState(settings.maintenanceWindowStart ?? "");
  const [mExpectedReturn, setMExpectedReturn] = useState(settings.maintenanceExpectedReturn ?? "");
  const [aEnabled, setAEnabled] = useState(settings.announcementEnabled);
  const [aMessage, setAMessage] = useState(settings.announcementMessage ?? "");
  const [aScheduledAt, setAScheduledAt] = useState(settings.announcementScheduledAt ?? "");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dev-settings"] });
    queryClient.invalidateQueries({ queryKey: ["system-status"] });
  };

  const saveMaintenanceSettings = useMutation({
    mutationFn: () =>
      devApi.updateMaintenanceSettings({ message: mMessage, windowStart: mWindowStart, expectedReturn: mExpectedReturn }),
    onSuccess: () => {
      toast.success("Configurações da tela de manutenção salvas.");
      invalidate();
    },
    onError: () => toast.error("Erro ao salvar configurações de manutenção."),
  });

  const saveAnnouncement = useMutation({
    mutationFn: () => devApi.updateAnnouncement({ enabled: aEnabled, message: aMessage, scheduledAt: aScheduledAt }),
    onSuccess: () => {
      toast.success(aEnabled ? "Aviso publicado para os usuários." : "Aviso desativado.");
      invalidate();
    },
    onError: () => toast.error("Erro ao salvar o aviso."),
  });

  return (
    <>
      {/* Tela de manutenção */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="px-5 py-4 border-b border-border bg-muted/50 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>
            Tela de Manutenção
          </h4>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[12px] text-muted-foreground -mt-1">
            O que os usuários veem quando o sistema está em manutenção. Salvo em tempo real, sem redeploy.
          </p>
          <Field label="Mensagem" hint="Deixe em branco para usar a mensagem padrão.">
            <textarea
              value={mMessage}
              onChange={(e) => setMMessage(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ex.: Estamos aplicando atualizações. Voltamos logo."
              className={inputClass + " resize-y"}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Início da janela" hint="Opcional — exibido como 'Das … às …'.">
              <input type="datetime-local" value={mWindowStart} onChange={(e) => setMWindowStart(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Previsão de retorno" hint="Vira a contagem regressiva na tela.">
              <input type="datetime-local" value={mExpectedReturn} onChange={(e) => setMExpectedReturn(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => saveMaintenanceSettings.mutate()}
              disabled={saveMaintenanceSettings.isPending}
              className="flex items-center gap-2 bg-primary hover:opacity-90 text-primary-foreground px-4 py-2.5 rounded-xl text-[13px] shadow-sm transition-all disabled:opacity-50"
              style={{ fontWeight: 600 }}
            >
              <Save className="w-4 h-4" />
              Salvar configurações
            </button>
          </div>
        </div>
      </div>

      {/* Aviso programado (banner) */}
      <div className={`bg-card rounded-xl border shadow-sm ${aEnabled ? "border-amber-200 dark:border-amber-800" : "border-border"}`}>
        <div className={`px-5 py-4 border-b flex items-center gap-2 ${aEnabled ? "border-amber-100 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/40" : "border-border bg-muted/50"}`}>
          <Megaphone className={`w-4 h-4 ${aEnabled ? "text-amber-600" : "text-muted-foreground"}`} />
          <h4 className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>
            Aviso Programado
          </h4>
          <span className={`ml-auto text-[11px] ${aEnabled ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} style={{ fontWeight: 600 }}>
            {aEnabled ? "VISÍVEL" : "OCULTO"}
          </span>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[12px] text-muted-foreground -mt-1">
            Banner exibido no topo para todos os usuários logados — ideal para anunciar uma manutenção antes dela acontecer.
          </p>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={aEnabled} onChange={(e) => setAEnabled(e.target.checked)} className="w-4 h-4 rounded border-border accent-amber-600" />
            <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
              Exibir aviso para os usuários
            </span>
          </label>

          <Field label="Mensagem do aviso">
            <textarea
              value={aMessage}
              onChange={(e) => setAMessage(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ex.: Manutenção programada no sábado à noite. O sistema ficará indisponível por ~1h."
              className={inputClass + " resize-y"}
            />
          </Field>
          <Field label="Data/hora prevista" hint="Opcional — o aviso some automaticamente após este momento.">
            <input type="datetime-local" value={aScheduledAt} onChange={(e) => setAScheduledAt(e.target.value)} className={inputClass} />
          </Field>

          <div className="flex justify-end">
            <button
              onClick={() => saveAnnouncement.mutate()}
              disabled={saveAnnouncement.isPending || (aEnabled && !aMessage.trim())}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-[13px] shadow-sm transition-all disabled:opacity-50"
              style={{ fontWeight: 600 }}
            >
              <Save className="w-4 h-4" />
              {aEnabled ? "Publicar aviso" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function DevPage() {
  usePageTitle("Dev Panel");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<"enable" | "disable" | null>(null);

  // Polling de status a cada 10s
  const { data: maintenanceStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ["maintenance-status"],
    queryFn: devApi.getMaintenanceStatus,
    refetchInterval: 10_000,
    retry: 1,
  });

  // Info real do backend (java/spring/os/ambiente). O sucesso/erro da query define o status "Online/Offline".
  const {
    data: systemInfo,
    isSuccess: backendOnline,
    isError: backendOffline,
    isLoading: loadingInfo,
  } = useQuery({
    queryKey: ["dev-system-info"],
    queryFn: devApi.getSystemInfo,
    refetchInterval: 30_000,
    retry: 1,
  });

  // Configurações da Central de Manutenção (alimenta o formulário).
  const { data: settings } = useQuery({
    queryKey: ["dev-settings"],
    queryFn: devApi.getSettings,
  });

  const isMaintenanceActive = maintenanceStatus?.active ?? false;

  const enableMutation = useMutation({
    mutationFn: devApi.enableMaintenance,
    onSuccess: () => {
      toast.success("Modo manutenção ativado. Usuários serão redirecionados.");
      queryClient.invalidateQueries({ queryKey: ["maintenance-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      setConfirmAction(null);
    },
    onError: () => {
      toast.error("Erro ao ativar manutenção.");
      setConfirmAction(null);
    },
  });

  const disableMutation = useMutation({
    mutationFn: devApi.disableMaintenance,
    onSuccess: () => {
      toast.success("Sistema retomado. Manutenção desativada.");
      queryClient.invalidateQueries({ queryKey: ["maintenance-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      setConfirmAction(null);
    },
    onError: () => {
      toast.error("Erro ao desativar manutenção.");
      setConfirmAction(null);
    },
  });

  const handleConfirm = () => {
    if (confirmAction === "enable") enableMutation.mutate();
    else if (confirmAction === "disable") disableMutation.mutate();
  };

  const isMutating = enableMutation.isPending || disableMutation.isPending;

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center flex-shrink-0">
          <Terminal className="w-5 h-5 text-violet-700 dark:text-violet-400" />
        </div>
        <div>
          <h3 className="text-[18px] text-foreground" style={{ fontWeight: 700 }}>
            Painel do Desenvolvedor
          </h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Administração remota: manutenção, comunicação com usuários e status do sistema
          </p>
        </div>

        {/* Badge de acesso restrito */}
        <div className="ml-auto shrink-0 flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-[11px] px-2.5 py-1.5 rounded-lg" style={{ fontWeight: 600 }}>
          <Code2 className="w-3.5 h-3.5" />
          Acesso DEV
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Coluna principal ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Card: Modo Manutenção */}
          <div className={`bg-card rounded-xl border shadow-sm overflow-hidden ${isMaintenanceActive ? "border-rose-200 dark:border-rose-800" : "border-border"}`}>
            <div className={`px-5 py-4 border-b flex items-center gap-3 ${isMaintenanceActive ? "border-rose-100 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/40" : "border-border bg-muted/50"}`}>
              <Wrench className={`w-4 h-4 ${isMaintenanceActive ? "text-rose-600" : "text-muted-foreground"}`} />
              <h4 className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>
                Controle de Manutenção
              </h4>
              {loadingStatus ? (
                <div className="ml-auto w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
              ) : (
                <div className="ml-auto flex items-center gap-2">
                  <StatusDot active={isMaintenanceActive} />
                  <span
                    className={`text-[12px] ${isMaintenanceActive ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}
                    style={{ fontWeight: 600 }}
                  >
                    {isMaintenanceActive ? "ATIVO" : "INATIVO"}
                  </span>
                </div>
              )}
            </div>

            <div className="p-5">
              {isMaintenanceActive ? (
                <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800 rounded-xl mb-5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[13px] text-rose-800 dark:text-rose-200" style={{ fontWeight: 600 }}>
                      Sistema em manutenção
                    </p>
                    <p className="text-[12px] text-rose-600 dark:text-rose-400 mt-0.5 leading-relaxed">
                      Todos os usuários estão sendo redirecionados para a tela de manutenção.
                      Apenas você (DEV) e o status público continuam acessíveis.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 rounded-xl mb-5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[13px] text-emerald-800 dark:text-emerald-200" style={{ fontWeight: 600 }}>
                      Sistema operacional
                    </p>
                    <p className="text-[12px] text-emerald-600 dark:text-emerald-400 mt-0.5 leading-relaxed">
                      Todos os serviços estão funcionando normalmente. A tela de manutenção faz polling a cada 30s.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {isMaintenanceActive ? (
                  <button
                    onClick={() => setConfirmAction("disable")}
                    disabled={isMutating}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-[13px] shadow-sm transition-all disabled:opacity-50"
                    style={{ fontWeight: 600 }}
                  >
                    <Power className="w-4 h-4" />
                    Restaurar Sistema
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmAction("enable")}
                    disabled={isMutating}
                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-[13px] shadow-sm transition-all disabled:opacity-50"
                    style={{ fontWeight: 600 }}
                  >
                    <PowerOff className="w-4 h-4" />
                    Ativar Manutenção
                  </button>
                )}
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["maintenance-status"] })}
                  disabled={loadingStatus}
                  className="flex items-center gap-2 border border-border text-muted-foreground hover:bg-muted px-4 py-2.5 rounded-xl text-[13px] transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? "animate-spin" : ""}`} />
                  Atualizar status
                </button>
              </div>

              <p className="mt-3 text-[11px] text-muted-foreground">
                Status atualizado automaticamente a cada 10 segundos.
              </p>
            </div>
          </div>

          {/* Central de Manutenção — só renderiza com as configurações carregadas */}
          {settings && <MaintenanceCentral settings={settings} />}

          {/* Card: Acesso Rápido */}
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <div className="px-5 py-4 border-b border-border bg-muted/50">
              <h4 className="text-[14px] text-foreground flex items-center gap-2" style={{ fontWeight: 700 }}>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                Acesso Rápido
              </h4>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  label: "Log de Auditoria",
                  description: "Histórico completo de ações do sistema",
                  icon: ShieldCheck,
                  color: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50",
                  action: () => navigate("/auditoria"),
                },
                {
                  label: "Gestão de Usuários",
                  description: "Criar, editar e gerenciar usuários",
                  icon: Users,
                  color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50",
                  action: () => navigate("/usuarios"),
                },
                {
                  label: "Dashboard",
                  description: "Visão geral dos equipamentos",
                  icon: Cpu,
                  color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50",
                  action: () => navigate("/"),
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/50 transition-all text-left"
                  >
                    <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                        {item.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-auto flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Coluna direita: Info do sistema ── */}
        <div className="space-y-5">
          {/* Frontend info */}
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <div className="px-5 py-4 border-b border-border bg-muted/50">
              <h4 className="text-[14px] text-foreground flex items-center gap-2" style={{ fontWeight: 700 }}>
                <Code2 className="w-4 h-4 text-muted-foreground" />
                Frontend
              </h4>
            </div>
            <div className="px-5 py-2">
              <InfoRow label="Versão"         value={`v${APP_VERSION}`} mono />
              <InfoRow label="Ambiente"        value={import.meta.env.MODE} mono />
              <InfoRow label="API Base URL"    value={API_URL} mono />
              <InfoRow
                label="Build"
                value={import.meta.env.PROD ? "Produção" : "Desenvolvimento"}
              />
            </div>
          </div>

          {/* Backend info — dados reais de /dev/system/info */}
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <div className="px-5 py-4 border-b border-border bg-muted/50 flex items-center justify-between">
              <h4 className="text-[14px] text-foreground flex items-center gap-2" style={{ fontWeight: 700 }}>
                <Database className="w-4 h-4 text-muted-foreground" />
                Backend
              </h4>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded" style={{ fontWeight: 600 }}>
                /dev/system/info
              </span>
            </div>
            <div className="px-5 py-2">
              <InfoRow label="Status API" value={
                loadingInfo ? (
                  <span className="text-muted-foreground" style={{ fontWeight: 600 }}>Verificando…</span>
                ) : backendOnline ? (
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400" style={{ fontWeight: 600 }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400" style={{ fontWeight: 600 }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                    {backendOffline ? "Offline" : "—"}
                  </span>
                )
              } />
              <InfoRow label="Manutenção" value={
                isMaintenanceActive
                  ? <span className="text-rose-600 dark:text-rose-400" style={{ fontWeight: 600 }}>Ativa</span>
                  : <span className="text-emerald-600 dark:text-emerald-400" style={{ fontWeight: 600 }}>Inativa</span>
              } />
              {systemInfo?.springVersion && <InfoRow label="Spring" value={`v${systemInfo.springVersion}`} mono />}
              {systemInfo?.javaVersion && <InfoRow label="Java" value={systemInfo.javaVersion} mono />}
              {systemInfo?.osName && <InfoRow label="SO" value={systemInfo.osName} />}
              {systemInfo?.environment && <InfoRow label="Ambiente" value={systemInfo.environment} mono />}
            </div>
          </div>

          {/* Comportamentos automáticos */}
          <div className="bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-800 rounded-xl p-4">
            <p className="text-[12px] text-violet-700 dark:text-violet-300 flex items-center gap-1.5 mb-3" style={{ fontWeight: 700 }}>
              <Clock className="w-3.5 h-3.5" />
              Comportamentos automáticos
            </p>
            <ul className="space-y-2 text-[12px] text-violet-600 dark:text-violet-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 dark:bg-violet-500 mt-1.5 flex-shrink-0" />
                Status de manutenção atualizado a cada <strong>10s</strong>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 dark:bg-violet-500 mt-1.5 flex-shrink-0" />
                Tela de manutenção reavalia de forma <strong>adaptativa</strong> (foco/rede)
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 dark:bg-violet-500 mt-1.5 flex-shrink-0" />
                Sessão expira após <strong>15min</strong> de inatividade
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 dark:bg-violet-500 mt-1.5 flex-shrink-0" />
                Aviso de expiração aparece com <strong>2min</strong> de antecedência
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Confirmação de ativar manutenção */}
      <ConfirmDialog
        open={confirmAction === "enable"}
        variant="warning"
        title="Ativar Modo Manutenção"
        message="Todos os usuários serão imediatamente redirecionados para a tela de manutenção e não conseguirão usar o sistema. Apenas você (DEV) continuará com acesso."
        requirePhrase="MANUTENCAO"
        confirmLabel="Ativar manutenção"
        cancelLabel="Cancelar"
        loading={enableMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Confirmação de desativar manutenção */}
      <ConfirmDialog
        open={confirmAction === "disable"}
        variant="warning"
        title="Restaurar Sistema"
        message="O sistema voltará a operar normalmente. Usuários que estiverem na tela de manutenção serão redirecionados automaticamente para o login em até 30 segundos."
        confirmLabel="Restaurar sistema"
        cancelLabel="Cancelar"
        loading={disableMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
