/** Atalhos de período do filtro da auditoria. */
export type PeriodKey = "" | "today" | "7d" | "30d" | "month" | "lastmonth" | "custom";

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "", label: "Qualquer data" },
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "month", label: "Este mês" },
  { value: "lastmonth", label: "Mês passado" },
  { value: "custom", label: "Personalizado…" },
];

/** AAAA-MM-DD no fuso local (toISOString usaria UTC e poderia virar o dia). */
export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Converte um atalho de período em datas (ambas inclusivas). Calculado na hora da
 * consulta, então um link "Hoje" aberto amanhã mostra o dia de amanhã — como o rótulo promete.
 */
export function resolvePeriod(period: PeriodKey, now = new Date()): { from?: string; to?: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  switch (period) {
    case "today": return { from: toIsoDate(today), to: toIsoDate(today) };
    case "7d": return { from: toIsoDate(daysAgo(6)), to: toIsoDate(today) };
    case "30d": return { from: toIsoDate(daysAgo(29)), to: toIsoDate(today) };
    case "month": return { from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: toIsoDate(today) };
    case "lastmonth": return {
      from: toIsoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
    default: return {};
  }
}
