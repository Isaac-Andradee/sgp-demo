import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Se definido, o usuário deve digitar exatamente essa frase para confirmar. */
  requirePhrase?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  requirePhrase,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [phrase, setPhrase] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const canConfirm = requirePhrase ? phrase === requirePhrase : true;

  useEffect(() => {
    if (open) {
      setPhrase("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Esc para cancelar
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  const colors =
    variant === "danger"
      ? { icon: "text-rose-600 dark:text-rose-400", iconBg: "bg-rose-100 dark:bg-rose-950/60", btn: "bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 shadow-rose-600/20", border: "border-rose-200 dark:border-rose-800" }
      : { icon: "text-amber-600 dark:text-amber-400", iconBg: "bg-amber-100 dark:bg-amber-950/60", btn: "bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 shadow-amber-600/20", border: "border-amber-200 dark:border-amber-800" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-[420px] bg-card rounded-2xl shadow-2xl overflow-hidden border border-border"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Header colorido */}
        <div className={`p-5 border-b ${colors.border} bg-muted/80`}>
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl ${colors.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              {variant === "danger" ? (
                <Trash2 className={`w-4 h-4 ${colors.icon}`} />
              ) : (
                <AlertTriangle className={`w-4 h-4 ${colors.icon}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>
                {title}
              </h3>
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{message}</p>
            </div>
            <button
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="p-5 space-y-4">
          {requirePhrase && (
            <div>
              <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>
                Para confirmar, digite{" "}
                <span className="font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded" style={{ fontWeight: 700 }}>
                  {requirePhrase}
                </span>{" "}
                abaixo:
              </label>
              <input
                ref={inputRef}
                type="text"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canConfirm && !loading) onConfirm(); }}
                placeholder={requirePhrase}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] bg-background outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 transition-all font-mono"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-2.5 border border-border text-muted-foreground hover:bg-muted rounded-xl text-[13px] transition-colors disabled:opacity-50"
              style={{ fontWeight: 500 }}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm || loading}
              className={`flex-1 py-2.5 text-white rounded-xl text-[13px] transition-all shadow-lg disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2 ${colors.btn}`}
              style={{ fontWeight: 600 }}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
