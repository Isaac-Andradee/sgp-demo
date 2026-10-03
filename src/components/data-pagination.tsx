import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { getPageItems } from "./pagination-utils";

interface Props {
  /** Página atual, base 0. */
  page: number;
  totalPages: number;
  totalElements: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  sizeOptions?: number[];
  /** Substantivo no plural para o resumo ("eventos", "equipamentos"...). */
  itemLabel?: string;
}

const navButton =
  "h-8 min-w-[32px] px-1.5 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

export function DataPagination({
  page,
  totalPages,
  totalElements,
  size,
  onPageChange,
  onSizeChange,
  sizeOptions = [20, 50, 100],
  itemLabel = "registros",
}: Props) {
  const [jumpValue, setJumpValue] = useState("");

  if (totalElements === 0) return null;

  const firstItem = page * size + 1;
  const lastItem = Math.min((page + 1) * size, totalElements);
  const isFirst = page <= 0;
  const isLast = page >= totalPages - 1;

  const jump = () => {
    const target = Number.parseInt(jumpValue, 10);
    setJumpValue("");
    if (Number.isNaN(target)) return;
    const clamped = Math.min(Math.max(target, 1), totalPages) - 1;
    if (clamped !== page) onPageChange(clamped);
  };

  return (
    <div className="px-4 md:px-5 py-3 border-t border-border bg-muted/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
        <p aria-live="polite">
          Mostrando{" "}
          <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
            {firstItem.toLocaleString("pt-BR")}–{lastItem.toLocaleString("pt-BR")}
          </span>{" "}
          de{" "}
          <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
            {totalElements.toLocaleString("pt-BR")}
          </span>{" "}
          {itemLabel}
        </p>
        <label className="flex items-center gap-1.5">
          Por página
          <select
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            aria-label="Itens por página"
            className="h-8 px-2 rounded-lg border border-border bg-background text-foreground text-[12px] outline-none focus:border-sky-400"
          >
            {sizeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <nav aria-label="Paginação" className="flex items-center gap-1">
            <button type="button" onClick={() => onPageChange(0)} disabled={isFirst} className={navButton} aria-label="Primeira página">
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => onPageChange(page - 1)} disabled={isFirst} className={navButton} aria-label="Página anterior">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {getPageItems(page, totalPages).map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-label={`Página ${item + 1}`}
                  aria-current={item === page ? "page" : undefined}
                  className={`h-8 min-w-[32px] px-2 rounded-lg text-[13px] tabular-nums transition-colors ${
                    item === page
                      ? "bg-primary text-white shadow-sm"
                      : "border border-border text-muted-foreground hover:bg-muted"
                  }`}
                  style={{ fontWeight: item === page ? 700 : 400 }}
                >
                  {(item + 1).toLocaleString("pt-BR")}
                </button>
              ) : (
                <span key={item} className="px-1 text-muted-foreground select-none" aria-hidden="true">…</span>
              ),
            )}
            <button type="button" onClick={() => onPageChange(page + 1)} disabled={isLast} className={navButton} aria-label="Próxima página">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => onPageChange(totalPages - 1)} disabled={isLast} className={navButton} aria-label="Última página">
              <ChevronsRight className="w-4 h-4" />
            </button>
          </nav>

          {totalPages > 7 && (
            <div className="flex items-center gap-1.5 ml-1 text-[12px] text-muted-foreground">
              <label htmlFor="pagination-jump">Ir para</label>
              <input
                id="pagination-jump"
                type="number"
                min={1}
                max={totalPages}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); jump(); } }}
                onBlur={jump}
                placeholder={String(page + 1)}
                className="h-8 w-16 px-2 rounded-lg border border-border bg-background text-foreground text-[12px] outline-none focus:border-sky-400 tabular-nums"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
