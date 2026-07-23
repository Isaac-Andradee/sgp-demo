import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, X, Users, Shield, Mail, User, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight, Check, Eye, EyeOff, RotateCcw, KeyRound, ShieldAlert, Lock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "../api/user.api";
import { authApi } from "../api/auth.api";
import type { UserResponse, UserRole, CreateUserRequest, CreateUserResponse, UpdateUserRequest, PagedResponse } from "../types";
import { USER_ROLE_LABELS } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { ConfirmDialog } from "./confirm-dialog";
import { SecretRevealDialog } from "./secret-reveal-dialog";

/** Hierarquia: DEV > ADMIN > USER > VIEWER. Apenas roles acima podem editar/excluir. ADMIN não edita/exclui DEV. */
function canEditUser(actorRole: UserRole | undefined, targetUser: UserResponse): boolean {
  if (!actorRole) return false;
  if (actorRole === "DEV") return true;
  if (actorRole === "ADMIN") return targetUser.role !== "DEV";
  return false; // USER e VIEWER não têm acesso à página de usuários (rota AdminOnly)
}

const PASSWORD_REGEX = /^(?=.{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).*$/;

/** Nome completo: 1–100 caracteres; apenas letras (Unicode), espaços, hífens e apóstrofos. */
const FULLNAME_REGEX = /^[\p{L}\s\-']+$/u;
const FULLNAME_MAX = 100;

/** Login preferido: um ponto (nome.sobrenome); sufixo opcional só com dígitos (ex.: maria.silva2). */
const USERNAME_REGEX = /^[a-z]+\.[a-z]+[0-9]*$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 50;

function validateFullName(value: string, required: boolean): string | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? "Nome completo é obrigatório." : null;
  if (trimmed.length < 1 || trimmed.length > FULLNAME_MAX) return "Nome completo deve ter entre 1 e 100 caracteres.";
  if (!FULLNAME_REGEX.test(trimmed)) return "Nome completo deve conter apenas letras, espaços, hífens ou apóstrofos.";
  return null;
}

function validateUsername(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) return "Login deve ter entre 3 e 50 caracteres.";
  if (!USERNAME_REGEX.test(trimmed)) return "Login deve ser no formato nome.sobrenome ou nome.sobrenome2 (apenas um ponto; sufixo opcional só com dígitos).";
  return null;
}

function validateEmail(value: string): string | null {
  const t = value.trim();
  if (!t) return "Email é obrigatório.";
  if (!t.includes("@") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Email inválido.";
  return null;
}

function validatePassword(value: string, required: boolean): string | null {
  if (!value) return required ? "Senha obrigatória." : null;
  if (!PASSWORD_REGEX.test(value)) return "Senha deve ter maiúscula, minúscula, número e caractere especial (mín. 8 chars).";
  return null;
}

function validatePasswordConfirm(password: string, confirm: string, passwordRequired: boolean): string | null {
  if (!confirm) return passwordRequired ? "Confirme a senha." : null;
  if (password !== confirm) return "As senhas não coincidem.";
  return null;
}

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:  "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  USER:   "bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800",
  VIEWER: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-border dark:border-gray-700",
  DEV:    "bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
};

function UserModal({
  open,
  onClose,
  onSaved,
  user,
  currentUserRole,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: CreateUserResponse) => void;
  user: UserResponse | null;
  currentUserRole: UserRole | undefined;
}) {
  /** ADMIN não pode atribuir role DEV; apenas DEV pode. */
  const assignableRoles: UserRole[] = currentUserRole === "DEV"
    ? (Object.keys(USER_ROLE_LABELS) as UserRole[])
    : (Object.keys(USER_ROLE_LABELS) as UserRole[]).filter((r) => r !== "DEV");
  const [form, setForm] = useState<{
    password: string; passwordConfirm: string; email: string; fullName: string; role: UserRole | ""; enabled: boolean;
  }>({ password: "", passwordConfirm: "", email: "", fullName: "", role: "", enabled: true });
  const [preferredUsername, setPreferredUsername] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ password: "", passwordConfirm: "", email: user.email, fullName: user.fullName, role: user.role, enabled: user.enabled ?? true });
      setSuggestions([]);
      setPreferredUsername("");
    } else {
      setForm({ password: "", passwordConfirm: "", email: "", fullName: "", role: "", enabled: true });
      setPreferredUsername("");
      setSuggestions([]);
    }
    setErrors({});
  }, [user, open]);

  // Sugestões de login ao criar usuário (debounce por fullName)
  useEffect(() => {
    if (user) return;
    const fullName = form.fullName.trim();
    if (!fullName || validateFullName(form.fullName, true) !== null) {
      setSuggestions([]);
      setPreferredUsername("");
      return;
    }
    if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current);
    suggestionsTimerRef.current = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const data = await authApi.suggestedUsernames(fullName);
        setSuggestions(data.suggestions ?? []);
        setPreferredUsername((prev) => (prev && (data.suggestions ?? []).includes(prev) ? prev : ""));
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 400);
    return () => {
      if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current);
    };
  }, [user, form.fullName]);

  const createMutation = useMutation({
    mutationFn: (data: CreateUserRequest) => userApi.create(data),
    onSuccess: (data) => {
      // A senha temporária é revelada uma única vez pelo componente pai.
      onSaved(data);
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string; validationErrors?: Record<string, string> } } };
      const msg = axErr?.response?.data?.message as string | undefined;
      if (msg?.includes("already taken") || msg?.toLowerCase().includes("username already taken")) {
        setErrors((prev) => ({ ...prev, username: "Este login já está em uso. Escolha outra sugestão ou deixe o sistema escolher." }));
      } else if (axErr?.response?.data?.validationErrors) {
        setErrors(axErr.response.data.validationErrors);
      } else {
        toast.error(msg ?? "Erro ao criar usuário.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) => userApi.update(id, data),
    onSuccess: () => { toast.success("Usuário atualizado com sucesso."); onSaved(); },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string; validationErrors?: Record<string, string> } } };
      if (axErr?.response?.data?.validationErrors) setErrors(axErr.response.data.validationErrors);
      else toast.error(axErr?.response?.data?.message ?? "Erro ao atualizar usuário.");
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!user) {
      // Sem senha no cadastro — o sistema gera uma temporária e força a troca.
      const fnErr = validateFullName(form.fullName, true);
      if (fnErr) e.fullName = fnErr;
      const unErr = validateUsername(preferredUsername);
      if (unErr) e.username = unErr;
    } else {
      if (form.password && !PASSWORD_REGEX.test(form.password)) e.password = "Senha deve ter maiúscula, minúscula, número e caractere especial (mín. 8 chars)";
      if (form.password && form.password !== form.passwordConfirm) e.passwordConfirm = "As senhas não coincidem.";
      if (form.fullName.trim() && form.fullName.trim() !== user.fullName) {
        const fnErr = validateFullName(form.fullName, false);
        if (fnErr) e.fullName = fnErr;
      }
    }
    if (!form.email.trim() || !form.email.includes("@")) e.email = "Email inválido";
    if (!user && !form.role) e.role = "Selecione o perfil de acesso";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    if (user) {
      const payload: UpdateUserRequest = {
        email: form.email.trim(),
        role: form.role as UserRole,
        enabled: form.enabled,
        ...(form.password ? { password: form.password } : {}),
        ...(form.fullName.trim() !== user.fullName ? { fullName: form.fullName.trim() } : {}),
      };
      updateMutation.mutate({ id: user.id, data: payload });
    } else {
      createMutation.mutate({
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        role: form.role as UserRole,
        ...(preferredUsername.trim() ? { username: preferredUsername.trim() } : {}),
      });
    }
  };

  if (!open) return null;

  const setFieldError = (key: string, err: string | null) => {
    setErrors((prev) => { const n = { ...prev }; if (err) n[key] = err; else delete n[key]; return n; });
  };

  const isCreate = !user;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-border">
        <div className="bg-[#0c4a6e] px-6 py-4 flex justify-between items-center">
          <h3 className="text-white text-[16px]" style={{ fontWeight: 600 }}>
            {user ? "Editar Usuário" : "Novo Usuário"}
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {user && (
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                Usuário (login)
              </label>
              <p className="text-[13px] text-foreground font-medium py-2">{user.username}</p>
              <p className="text-[11px] text-muted-foreground">O login é gerado pelo sistema e não pode ser alterado.</p>
            </div>
          )}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              <User className="w-3 h-3 inline mr-1" />Nome Completo
            </label>
            <input
              value={form.fullName}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, fullName: v }));
                setFieldError("fullName", validateFullName(v, isCreate));
              }}
              placeholder={user ? "Deixe como está para não alterar" : "Ex.: João dos Santos"}
              maxLength={FULLNAME_MAX}
              className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all ${errors.fullName ? "border-red-400" : "border-border"}`}
            />
            {errors.fullName && <p className="text-[11px] text-red-500 mt-1">{errors.fullName}</p>}
            {!user && <p className="text-[11px] text-muted-foreground mt-0.5">Apenas letras, espaços, hífens ou apóstrofos (1–100 caracteres). O login será gerado automaticamente.</p>}
          </div>
          {!user && (
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                Login preferido (opcional)
              </label>
              <input
                type="text"
                value={preferredUsername}
                onChange={(e) => {
                  const v = e.target.value.toLowerCase();
                  setPreferredUsername(v);
                  setFieldError("username", validateUsername(v));
                }}
                list="create-user-username-suggestions"
                placeholder={suggestionsLoading ? "Carregando sugestões..." : "Deixe vazio para o sistema gerar ou digite ex.: joao.silva"}
                maxLength={USERNAME_MAX}
                className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all bg-background ${errors.username ? "border-red-400" : "border-border"}`}
              />
              <datalist id="create-user-username-suggestions">
                {suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              {errors.username && <p className="text-[11px] text-red-500 mt-1">{errors.username}</p>}
              <p className="text-[11px] text-muted-foreground mt-0.5">Digite seu login (ex.: joao.silva) ou escolha uma sugestão. Se já estiver em uso, escolha outra ou tente um diferente.</p>
            </div>
          )}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              <Mail className="w-3 h-3 inline mr-1" />Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, email: v }));
                setFieldError("email", validateEmail(v));
              }}
              placeholder="email@exemplo.gov.br"
              className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all ${errors.email ? "border-red-400" : "border-border"}`}
            />
            {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              <Shield className="w-3 h-3 inline mr-1" />Perfil de Acesso
            </label>
            <select
              value={form.role}
              onChange={(e) => {
                const v = e.target.value as UserRole | "";
                setForm((f) => ({ ...f, role: v }));
                setFieldError("role", isCreate && !v ? "Selecione o perfil de acesso" : null);
              }}
              className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 text-[13px] outline-none bg-background ${errors.role ? "border-red-400" : "border-border"}`}
            >
              <option value="">Selecione o perfil</option>
              {[...assignableRoles]
                .sort((a, b) => USER_ROLE_LABELS[a].localeCompare(USER_ROLE_LABELS[b]))
                .map((r) => (
                  <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>
                ))}
            </select>
            {errors.role && <p className="text-[11px] text-red-500 mt-1">{errors.role}</p>}
          </div>
          {user ? (
            <>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  Nova Senha (deixe vazio para não alterar)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, password: v }));
                      setFieldError("password", validatePassword(v, isCreate));
                      setFieldError("passwordConfirm", validatePasswordConfirm(v, form.passwordConfirm, isCreate));
                    }}
                    placeholder="Nova senha (opcional)"
                    className={`w-full px-3 pr-10 py-2.5 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all ${errors.password ? "border-red-400" : "border-border"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] text-red-500 mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showPasswordConfirm ? "text" : "password"}
                    value={form.passwordConfirm}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, passwordConfirm: v }));
                      setFieldError("passwordConfirm", validatePasswordConfirm(form.password, v, isCreate));
                    }}
                    placeholder="Repita a nova senha (opcional)"
                    className={`w-full px-3 pr-10 py-2.5 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] transition-all ${errors.passwordConfirm ? "border-red-400" : "border-border"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                    aria-label={showPasswordConfirm ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.passwordConfirm && <p className="text-[11px] text-red-500 mt-1">{errors.passwordConfirm}</p>}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg border border-sky-100 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 p-3">
              <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-sky-500 dark:text-sky-400" />
              <p className="text-[12px] text-sky-800 dark:text-sky-200 leading-relaxed">
                Uma <strong>senha temporária</strong> será gerada e exibida uma única vez ao concluir o cadastro.
                Repasse-a ao usuário — ele será obrigado a definir a própria senha no primeiro acesso.
              </p>
            </div>
          )}
          {user && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary"
              />
              <span className="text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>Conta ativa</span>
            </label>
          )}
        </div>
        <div className="px-6 py-4 bg-muted border-t border-border flex justify-end gap-3">
          <button onClick={onClose} disabled={isSaving} className="px-5 py-2.5 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg text-[13px] transition-colors" style={{ fontWeight: 500 }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={isSaving} className="px-5 py-2.5 bg-primary hover:bg-[#075985] text-white rounded-lg text-[13px] shadow-sm transition-all flex items-center gap-2 disabled:opacity-60" style={{ fontWeight: 600 }}>
            {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {user ? "Salvar" : "Criar Usuário"}
          </button>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

export function UsuariosPage() {
  const queryClient = useQueryClient();
  const { user: currentUser, logout } = useAuth();
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [toggleTarget, setToggleTarget] = useState<UserResponse | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [justToggledId, setJustToggledId] = useState<string | null>(null);
  const [justToggledNewEnabled, setJustToggledNewEnabled] = useState<boolean | null>(null);
  /** Estado efetivo de ativo/inativo por id (evita refetch sobrescrever ícone e garante diálogo correto ao reativar) */
  const [enabledOverride, setEnabledOverride] = useState<Record<string, boolean>>({});
  // Recuperação de acesso (Camadas 1 e 2)
  const [resetTarget, setResetTarget] = useState<UserResponse | null>(null);
  const [recoveryTarget, setRecoveryTarget] = useState<UserResponse | null>(null);
  const [revealed, setRevealed] = useState<{ title: string; secret: string; description: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", page],
    queryFn: () => userApi.list(page, PAGE_SIZE),
    staleTime: 30_000,
  });

  // Camada 1 — alerta quando há menos de 2 ADMINs ativos (risco de lockout total)
  const { data: securityStatus } = useQuery({
    queryKey: ["users", "security-status"],
    queryFn: () => userApi.securityStatus(),
    staleTime: 60_000,
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => userApi.resetPassword(id),
    onSuccess: (res, id) => {
      const u = users.find((x) => x.id === id);
      setRevealed({
        title: "Senha temporária gerada",
        secret: res.temporaryPassword,
        description: `Repasse esta senha temporária a ${u?.fullName ?? "usuário"} (${u?.username ?? ""}). No próximo login o sistema exigirá que ela seja trocada.`,
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string } } };
      toast.error(axErr?.response?.data?.message ?? "Erro ao redefinir a senha.");
    },
  });

  const recoveryCodeMutation = useMutation({
    mutationFn: (id: string) => userApi.generateRecoveryCode(id),
    onSuccess: (res, id) => {
      const u = users.find((x) => x.id === id);
      setRevealed({
        title: "Código de recuperação gerado",
        secret: res.recoveryCode,
        description: `Guarde este código em local seguro. Ele permite que ${u?.fullName ?? "esta conta"} (${u?.username ?? ""}) recupere o acesso sozinho, sem depender de outro administrador. Um código anterior deixa de valer.`,
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string } } };
      toast.error(axErr?.response?.data?.message ?? "Erro ao gerar o código de recuperação.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: userApi.remove,
    onSuccess: () => {
      toast.success("Usuário removido com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string } } };
      toast.error(axErr?.response?.data?.message ?? "Erro ao remover usuário.");
    },
  });

  // PUT usa sempre as credenciais do usuário logado (cookie). O backend identifica o ator pelo
  // token; quem recebe 401 depois é só o usuário desativado, quando ele usar o token dele.
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      userApi.update(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => toast.error("Erro ao alterar status do usuário."),
  });

  const confirmToggle = () => {
    if (!toggleTarget) return;
    const id = toggleTarget.id;
    const newEnabled = !getEnabled(toggleTarget);
    setToggleTarget(null);
    setTogglingId(id);
    toggleMutation.mutate(
      { id, enabled: newEnabled },
      {
        onSuccess: () => {
          toast.success(newEnabled ? "Usuário ativado com sucesso." : "Usuário desativado com sucesso.");
          setJustToggledId(id);
          setJustToggledNewEnabled(newEnabled);
          setEnabledOverride((prev) => ({ ...prev, [id]: newEnabled }));
          queryClient.setQueryData<PagedResponse<UserResponse>>(
            ["users", page],
            (old) => {
              if (!old?.content) return old;
              return {
                ...old,
                content: old.content.map((u: UserResponse) =>
                  u.id === id ? { ...u, enabled: newEnabled } : u
                ),
              };
            }
          );
          setTimeout(() => {
            setJustToggledId(null);
            setJustToggledNewEnabled(null);
          }, 1800);
          if (!newEnabled && currentUser?.id === id) {
            logout().then(() => {
              window.location.replace("/login");
            });
          }
        },
        onSettled: () => setTogglingId(null),
      }
    );
  };

  const handleSaved = (created?: CreateUserResponse) => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    setModalOpen(false);
    setEditingUser(null);
    if (created) {
      setRevealed({
        title: "Usuário criado — senha temporária",
        secret: created.temporaryPassword,
        description: `Repasse esta senha temporária a ${created.fullName} (login: ${created.username}). No primeiro acesso o sistema exigirá que ele defina a própria senha.`,
      });
    }
  };

  const handleDelete = (u: UserResponse) => {
    if (!confirm(`Deseja remover o usuário "${u.username}"? Esta ação não pode ser desfeita.`)) return;
    deleteMutation.mutate(u.id);
  };

  const users = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  const getEnabled = (u: UserResponse) => enabledOverride[u.id] ?? u.enabled ?? true;

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-[18px] text-foreground" style={{ fontWeight: 700 }}>Gestao de Usuarios</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie os usuarios do sistema</p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setModalOpen(true); }}
          className="bg-primary hover:bg-[#075985] text-white px-4 py-2.5 rounded-lg text-[13px] shadow-lg shadow-sky-600/10 transition-all duration-200 flex items-center gap-2"
          style={{ fontWeight: 600 }}
        >
          <Plus className="w-4 h-4" />
          Novo Usuario
        </button>
      </div>

      {/* Camada 1 — Aviso de redundância de administradores */}
      {securityStatus?.needsSecondAdmin && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] text-amber-800 dark:text-amber-200" style={{ fontWeight: 600 }}>
              Cadastre um segundo administrador
            </p>
            <p className="text-[12px] text-amber-700 dark:text-amber-300/90 mt-0.5">
              Existe apenas {securityStatus.activeAdminCount} administrador ativo. Com dois ADMINs, um pode
              redefinir a senha do outro caso alguém perca o acesso. Recomendamos também gerar um código de
              recuperação para cada administrador.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted">
                {["Nome", "Usuario", "Email", "Perfil", "Status", "Acoes"].map((h, i) => (
                  <th key={h} className={`px-4 md:px-6 py-3.5 text-[10px] text-muted-foreground uppercase tracking-wider ${i === 5 ? "text-right" : ""}`} style={{ fontWeight: 700 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 md:px-6 py-3.5"><div className="h-4 bg-muted rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-[14px] text-muted-foreground" style={{ fontWeight: 500 }}>Nenhum usuário encontrado</p>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 md:px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{u.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3.5 text-muted-foreground text-[12px]">{u.username}</td>
                    <td className="px-4 md:px-6 py-3.5 text-muted-foreground text-[12px]">{u.email}</td>
                    <td className="px-4 md:px-6 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border ${ROLE_COLORS[u.role]}`} style={{ fontWeight: 600 }}>
                        {USER_ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3.5">
                      {canEditUser(currentUser?.role, u) ? (
                        <button
                          onClick={() => setToggleTarget(u)}
                          disabled={togglingId === u.id}
                          className="flex items-center gap-1.5 transition-all min-w-[90px]"
                          title={getEnabled(u) ? "Desativar" : "Ativar"}
                        >
                          {togglingId === u.id ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 border-2 border-sky-300 border-t-primary rounded-full animate-spin" />
                              <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>Alterando...</span>
                            </div>
                          ) : justToggledId === u.id ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 animate-pulse">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                              </span>
                              <span className="text-[12px]" style={{ fontWeight: 500 }}>
                                {justToggledNewEnabled ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                          ) : getEnabled(u) ? (
                            <>
                              <ToggleRight className="w-5 h-5 text-emerald-500" />
                              <span className="text-[12px] text-emerald-600" style={{ fontWeight: 500 }}>Ativo</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                              <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>Inativo</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
                          {getEnabled(u) ? "Ativo" : "Inativo"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-3.5 text-right">
                      {canEditUser(currentUser?.role, u) ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditingUser(u); setModalOpen(true); }}
                            className="p-2 text-muted-foreground hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setResetTarget(u)}
                            disabled={resetPasswordMutation.isPending}
                            className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-all disabled:opacity-40"
                            title="Redefinir senha (gera senha temporária)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          {(u.role === "ADMIN" || u.role === "DEV") && (
                            <button
                              onClick={() => setRecoveryTarget(u)}
                              disabled={recoveryCodeMutation.isPending}
                              className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-all disabled:opacity-40"
                              title={u.hasRecoveryCode ? "Regenerar código de recuperação" : "Gerar código de recuperação"}
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(u)}
                            className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-muted/50 px-4 md:px-6 py-3 border-t border-border flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">
              Total: <span style={{ fontWeight: 600 }}>{data?.totalElements}</span> usuário(s)
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i).map((i) => (
                <button key={i} onClick={() => setPage(i)} className={`w-8 h-8 rounded-lg text-[13px] transition-all ${page === i ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`} style={{ fontWeight: page === i ? 600 : 400 }}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <UserModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingUser(null); }}
        onSaved={handleSaved}
        user={editingUser}
        currentUserRole={currentUser?.role}
      />

      {/* Confirmação ao ativar/desativar usuário */}
      <ConfirmDialog
        open={!!toggleTarget}
        variant="warning"
        title={toggleTarget ? (getEnabled(toggleTarget) ? "Desativar usuário?" : "Ativar usuário?") : ""}
        message={
          toggleTarget
            ? getEnabled(toggleTarget)
              ? `O usuário "${toggleTarget.fullName}" (${toggleTarget.username}) não poderá mais acessar o sistema até que seja ativado novamente.`
              : `O usuário "${toggleTarget.fullName}" (${toggleTarget.username}) voltará a poder acessar o sistema.`
            : ""
        }
        confirmLabel={toggleTarget ? (getEnabled(toggleTarget) ? "Desativar" : "Ativar") : "Confirmar"}
        cancelLabel="Cancelar"
        loading={toggleMutation.isPending}
        onConfirm={confirmToggle}
        onCancel={() => setToggleTarget(null)}
      />

      {/* Camada 1 — Confirmar reset de senha */}
      <ConfirmDialog
        open={!!resetTarget}
        variant="warning"
        title="Redefinir senha?"
        message={
          resetTarget
            ? `Será gerada uma senha temporária para "${resetTarget.fullName}" (${resetTarget.username}). A senha atual deixará de funcionar e o usuário terá que definir uma nova no próximo login. A senha temporária aparecerá uma única vez para você repassar.`
            : ""
        }
        confirmLabel="Gerar senha temporária"
        cancelLabel="Cancelar"
        loading={resetPasswordMutation.isPending}
        onConfirm={() => {
          if (resetTarget) resetPasswordMutation.mutate(resetTarget.id);
          setResetTarget(null);
        }}
        onCancel={() => setResetTarget(null)}
      />

      {/* Camada 2 — Confirmar geração de código de recuperação */}
      <ConfirmDialog
        open={!!recoveryTarget}
        variant="warning"
        title={recoveryTarget?.hasRecoveryCode ? "Regenerar código de recuperação?" : "Gerar código de recuperação?"}
        message={
          recoveryTarget
            ? `${recoveryTarget.hasRecoveryCode ? "Um novo código será gerado e o anterior deixará de valer. " : ""}O código permite que "${recoveryTarget.fullName}" (${recoveryTarget.username}) recupere o acesso sozinho, sem depender de outro administrador. Ele será exibido uma única vez.`
            : ""
        }
        confirmLabel={recoveryTarget?.hasRecoveryCode ? "Regenerar código" : "Gerar código"}
        cancelLabel="Cancelar"
        loading={recoveryCodeMutation.isPending}
        onConfirm={() => {
          if (recoveryTarget) recoveryCodeMutation.mutate(recoveryTarget.id);
          setRecoveryTarget(null);
        }}
        onCancel={() => setRecoveryTarget(null)}
      />

      {/* Exibição única do segredo (senha temporária / código de recuperação) */}
      <SecretRevealDialog
        open={!!revealed}
        title={revealed?.title ?? ""}
        secret={revealed?.secret ?? ""}
        description={revealed?.description ?? ""}
        onClose={() => setRevealed(null)}
      />
    </div>
  );
}
