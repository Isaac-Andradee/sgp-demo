import { useState } from "react";
import { X, Copy, Check, ShieldAlert, KeyRound } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  /** O segredo em texto puro (senha temporária ou código de recuperação). */
  secret: string;
  /** Mensagem explicativa exibida acima do segredo. */
  description: string;
  onClose: () => void;
}

/**
 * Exibe um segredo sensível (senha temporária ou código de recuperação) UMA ÚNICA VEZ.
 * Não é possível recuperá-lo depois de fechar — por isso o alerta e o botão de copiar.
 */
export function SecretRevealDialog({ open, title, secret, description, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleCopy = async () => {
    // navigator.clipboard só existe em contexto seguro (HTTPS/localhost); servido
    // via nginx em HTTP na rede local ele é undefined — usa o fallback legado.
    if (window.isSecureContext && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(secret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        // cai para o fallback abaixo
      }
    }
    const textarea = document.createElement("textarea");
    textarea.value = secret;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      if (document.execCommand("copy")) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } finally {
      document.body.removeChild(textarea);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-[440px] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40">
              <KeyRound className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
            </span>
            <h3 className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{title}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-[13px] text-muted-foreground">{description}</p>

          <div className="flex items-stretch gap-2">
            <div className="flex-1 px-4 py-3 bg-muted rounded-xl border border-border font-mono text-[16px] text-foreground tracking-wide break-all select-all" style={{ fontWeight: 600 }}>
              {secret}
            </div>
            <button
              onClick={handleCopy}
              className="shrink-0 px-3.5 rounded-xl bg-primary hover:bg-[#075985] text-white transition-all flex items-center justify-center"
              title="Copiar"
            >
              {copied ? <Check className="w-4.5 h-4.5" /> : <Copy className="w-4.5 h-4.5" />}
            </button>
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-800 dark:text-amber-200">
              Guarde agora — por segurança, este valor <strong>não poderá ser visto novamente</strong> depois de fechar.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-primary hover:bg-[#075985] text-white py-3 rounded-xl transition-all text-[14px]"
            style={{ fontWeight: 600 }}
          >
            Já anotei, fechar
          </button>
        </div>
      </div>
    </div>
  );
}
