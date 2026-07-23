import { api } from './client';
import type { EquipmentType, EquipmentStatus } from '../types';

export interface InventoryReportParams {
  setorId?: string;
  tipo?: EquipmentType;
  status?: EquipmentStatus;
  marca?: string;
  textoBusca?: string;
}

export const reportApi = {
  /** Baixa o Relatório de Inventário em PDF com os filtros informados. */
  inventory: async (params: InventoryReportParams): Promise<{ blob: Blob; filename: string }> => {
    // Envia apenas os parâmetros preenchidos (evita conversão de string vazia em enum no backend).
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') cleaned[k] = String(v);
    }
    const res = await api.get('/reports/inventory', { params: cleaned, responseType: 'blob' });
    return toDownload(res, `inventario-sgp-${new Date().toISOString().slice(0, 10)}.pdf`);
  },

  /** Baixa a Ficha do Equipamento em PDF. */
  equipmentSheet: async (equipmentId: string): Promise<{ blob: Blob; filename: string }> => {
    const res = await api.get(`/reports/equipment/${equipmentId}`, { responseType: 'blob' });
    return toDownload(res, `ficha-equipamento-${new Date().toISOString().slice(0, 10)}.pdf`);
  },

  /** Baixa o Resumo Executivo em PDF. */
  summary: async (): Promise<{ blob: Blob; filename: string }> => {
    const res = await api.get('/reports/summary', { responseType: 'blob' });
    return toDownload(res, `resumo-executivo-sgp-${new Date().toISOString().slice(0, 10)}.pdf`);
  },
};

// Extrai o blob + nome de arquivo (do Content-Disposition, com fallback) de uma resposta.
function toDownload(res: { data: unknown; headers: Record<string, unknown> }, fallback: string): { blob: Blob; filename: string } {
  const cd = (res.headers['content-disposition'] as string | undefined) ?? '';
  const match = cd.match(/filename="?([^"]+)"?/);
  return { blob: res.data as Blob, filename: match?.[1] ?? fallback };
}

/** Dispara o download de um Blob no navegador. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
