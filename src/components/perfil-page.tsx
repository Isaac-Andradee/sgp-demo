import { useState } from "react";
import { User, Lock, Shield, Eye, EyeOff, Clock, Save } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../api/auth.api";
import { USER_ROLE_LABELS } from "../types";
import { toast } from "sonner";

const PASSWORD_REGEX = /^(?=.{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).*$/;
// Mesmo padrão validado no backend (letras Unicode, espaços, hífens e apóstrofos).
const NAME_REGEX = /^\p{L}+([ '-]\p{L}+)*$/u;

function PasswordInput({
  value,
  onChange,
  placeholder,
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 pr-10 py-2.5 border border-border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] bg-background transition-all"
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function PerfilPage() {
  const { user, refetchUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");

  const [nameInput, setNameInput] = useState(user?.fullName ?? "");
  const [nameError, setNameError] = useState("");
  const nameChanged = nameInput.trim() !== (user?.fullName ?? "");

  const updateProfileMutation = useMutation({
    mutationFn: (fullName: string) => authApi.updateProfile({ fullName }),
    onSuccess: async () => {
      toast.success("Nome atualizado com sucesso!");
      await refetchUser();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { message?: string } } };
      toast.error(axErr?.response?.data?.message ?? "Erro ao atualizar o nome.");
    },
  });

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!NAME_REGEX.test(trimmed)) {
      setNameError("Nome deve conter apenas letras, espaços, hífens ou apóstrofos.");
      return;
    }
    setNameError("");
    updateProfileMutation.mutate(trimmed);
  };

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(user!.id, data),
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwError("");
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axErr?.response?.status === 400) {
        setPwError("Senha atual incorreta.");
      } else {
        setPwError(axErr?.response?.data?.message ?? "Erro ao alterar senha.");
      }
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");

    if (!PASSWORD_REGEX.test(newPassword)) {
      setPwError("Senha deve ter mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("As senhas não coincidem.");
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="mb-6">
        <h3 className="text-[18px] text-foreground" style={{ fontWeight: 700 }}>Meu Perfil</h3>
        <p className="text-[13px] text-muted-foreground mt-0.5">Visualize seus dados e altere sua senha</p>
      </div>

      {/* User info card */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h4 className="text-[17px] text-foreground" style={{ fontWeight: 700 }}>
              {user?.fullName || user?.username}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span className="text-[12px] text-primary bg-primary/10 px-2 py-0.5 rounded" style={{ fontWeight: 600 }}>
                {user?.role ? USER_ROLE_LABELS[user.role] : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <form onSubmit={handleSaveName} className="md:col-span-2">
            <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" style={{ fontWeight: 700 }}>Nome de Exibição</label>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => { setNameInput(e.target.value); if (nameError) setNameError(""); }}
                  placeholder="Seu nome completo"
                  className={`w-full px-3 py-2.5 border rounded-lg focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 outline-none text-[13px] bg-background transition-all ${nameError ? "border-red-400" : "border-border"}`}
                />
                {nameError && <p className="text-[11px] text-red-500 mt-1">{nameError}</p>}
              </div>
              <button
                type="submit"
                disabled={!nameChanged || updateProfileMutation.isPending}
                className="px-4 py-2.5 bg-primary hover:bg-[#075985] text-white rounded-lg text-[13px] shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontWeight: 600 }}
              >
                {updateProfileMutation.isPending
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </form>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1" style={{ fontWeight: 700 }}>Usuario</p>
            <p className="text-[14px] text-foreground" style={{ fontWeight: 500 }}>{user?.username}</p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1" style={{ fontWeight: 700 }}>Email</p>
            <p className="text-[14px] text-foreground" style={{ fontWeight: 500 }}>{user?.email}</p>
          </div>
          <div className={`md:col-span-2 rounded-lg p-3 flex items-start gap-2.5 border ${
            user?.previousLoginAt
              ? "bg-sky-50 dark:bg-sky-950/40 border-sky-100 dark:border-sky-800"
              : "bg-muted border-border"
          }`}>
            <Clock className={`w-4 h-4 mt-0.5 flex-shrink-0 ${user?.previousLoginAt ? "text-sky-500 dark:text-sky-400" : "text-muted-foreground"}`} />
            <div>
              <p
                className={`text-[10px] uppercase tracking-wider mb-0.5 ${user?.previousLoginAt ? "text-sky-500 dark:text-sky-400" : "text-muted-foreground"}`}
                style={{ fontWeight: 700 }}
              >
                Último Acesso
              </p>
              {user?.previousLoginAt ? (
                <>
                  <p className="text-[13px] text-sky-800 dark:text-sky-200" style={{ fontWeight: 500 }}>
                    {new Date(user.previousLoginAt).toLocaleString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-[11px] text-sky-400 dark:text-sky-300 mt-0.5">
                    Este foi seu acesso anterior a esta sessão. Se não foi você, contate o administrador imediatamente.
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground" style={{ fontWeight: 400 }}>
                  Este é o seu primeiro acesso — ainda não há um acesso anterior registrado.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-4 h-4 text-primary" />
          <h4 className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>Alterar Senha</h4>
        </div>

        {pwError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg text-[13px] text-red-700 dark:text-red-300">{pwError}</div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>Senha Atual</label>
            <PasswordInput
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Sua senha atual"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>Nova Senha</label>
            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Mín. 8 chars, maiúscula, número e especial"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>Confirmar Nova Senha</label>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirme a nova senha"
              required
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            A senha deve conter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial.
          </p>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="px-5 py-2.5 bg-primary hover:bg-[#075985] text-white rounded-lg text-[13px] shadow-sm transition-all flex items-center gap-2 disabled:opacity-60"
              style={{ fontWeight: 600 }}
            >
              {changePasswordMutation.isPending && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Alterar Senha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
