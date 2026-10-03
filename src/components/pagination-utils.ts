export type PageItem = number | "ellipsis-start" | "ellipsis-end";

/**
 * Páginas a exibir (base 0): sempre a primeira e a última, a atual e uma vizinha
 * de cada lado; o resto vira reticências. Ex.: 0 … 4 5 6 … 64.
 */
export function getPageItems(current: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);

  const last = totalPages - 1;
  // Perto das pontas, mostra um bloco contínuo de 4 para não "pular" a navegação.
  const start = current <= 3 ? 1 : current >= last - 3 ? last - 4 : current - 1;
  const end = current <= 3 ? 4 : current >= last - 3 ? last - 1 : current + 1;

  const items: PageItem[] = [0];
  if (start > 1) items.push("ellipsis-start");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < last - 1) items.push("ellipsis-end");
  items.push(last);
  return items;
}
