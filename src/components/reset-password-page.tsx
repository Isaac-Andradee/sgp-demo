import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { Network, Lock, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { authApi } from "../api/auth.api";
import { usePageTitle } from "../hooks/usePageTitle";
import { toast } from "sonner";

const PASSWORD_REGEX = /^(?=.{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).*$/;

export function ResetPasswordPage() {
  usePageTitle("Redefinir Senha");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!PASSWORD_REGEX.test(password)) {
      setError("Senha deve ter mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!token) {
      setError("Token inválido. Solicite um novo link de redefinição.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string } } };
      setError(axErr?.response?.data?.message ?? "Token inválido, expirado ou já utilizado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        fontFamily: "'Inter', sans-serif",
        background: "linear-gradient(135deg, #0c4a6e 0%, #075985 30%, #0369a1 70%, #0284c7 100%)",
      }}
    >
      <div className="w-full max-w-[420px] relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm mb-4 border border-white/20">
            <Network className="w-8 h-8 text-sky-300" />
          </div>
          <h1 className="text-white text-[28px] tracking-tight" style={{ fontWeight: 700 }}>
            SGP <span className="text-sky-300">Demo</span>
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8">
            {done ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h3 className="text-[18px] text-gray-900" style={{ fontWeight: 600 }}>Senha redefinida!</h3>
                <p className="text-[13px] text-gray-500">Você será redirecionado para o login em instantes...</p>
              </div>
            ) : (
              <>
                <h3 className="text-[18px] text-gray-900 mb-1 text-center" style={{ fontWeight: 600 }}>
                  Nova Senha
                </h3>
                <p className="text-[13px] text-gray-400 mb-6 text-center">
                  Defina sua nova senha de acesso.
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[12px] text-gray-500 mb-1.5" style={{ fontWeight: 500 }}>Nova Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px]"
                        placeholder="Nova senha"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={-1}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] text-gray-500 mb-1.5" style={{ fontWeight: 500 }}>Confirmar Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        className="w-full pl-10 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px]"
                        placeholder="Confirme a nova senha"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={-1}
                        aria-label={showConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#0369a1] hover:bg-[#075985] text-white py-3 rounded-xl shadow-lg shadow-sky-600/20 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 text-[14px]"
                    style={{ fontWeight: 600 }}
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Redefinir Senha"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link to="/login" className="text-[13px] text-sky-600 hover:text-sky-700 transition-colors">
                    Voltar ao login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
