import { api } from './client';
import type {
  EquipmentResponseDTO,
  CreateEquipmentDTO,
  EquipmentFilterDTO,
  MoveEquipmentDTO,
  SwapEquipmentDTO,
  DashboardStatsDTO,
  SectorMetricDTO,
  PagedResponse,
  EquipmentType,
  EquipmentStatus,
  DefectResponse,
  CreateDefectRequest,
} from '../types';

/**
 * Normaliza apenas os nomes das chaves da API para o DTO do front.
 * Aceita type/status ou alternativas (equipmentType, equipment_type, tipo, situacao).
 * Não inventa valores: só mapeia o que vier do backend.
 */
function normalizeEquipmentItem(raw: unknown): EquipmentResponseDTO {
  const o = raw as Record<string, unknown>;
  const type = (o.type ?? o.equipmentType ?? o.equipment_type ?? o.tipo) as EquipmentType | undefined;
  const status = (o.status ?? o.equipmentStatus ?? o.equipment_status ?? o.situacao) as EquipmentStatus | undefined;
  const serialNumber = (o.serialNumber ?? o.serial ?? o.numeroSerie ?? o.numero_serie) as string | undefined;
  return {
    ...o,
    ...(type !== undefined && { type }),
    ...(status !== undefined && { status }),
    ...(serialNumber !== undefined && { serialNumber }),
  } as EquipmentResponseDTO;
}

export const equipmentApi = {
  list: (page = 0, size = 20, sortBy = 'createdAt', sortDirection = 'DESC') =>
    api.get<PagedResponse<EquipmentResponseDTO>>('/equipments', {
      params: { page, size, sortBy, sortDirection },
    }).then(r => ({
      ...r.data,
      content: (r.data.content ?? []).map((item) => normalizeEquipmentItem(item)),
    })),

  filter: (filters: EquipmentFilterDTO) =>
    api.post<EquipmentResponseDTO[]>('/equipments/filter', filters).then(r =>
      (Array.isArray(r.data) ? r.data : []).map((item) => normalizeEquipmentItem(item))
    ),

  create: (data: CreateEquipmentDTO) =>
    api.post<EquipmentResponseDTO>('/equipments', data).then(r => normalizeEquipmentItem(r.data)),

  update: (id: string, data: CreateEquipmentDTO) =>
    api.put<EquipmentResponseDTO>(`/equipments/${id}`, data).then(r => normalizeEquipmentItem(r.data)),

  remove: (id: string) =>
    api.delete(`/equipments/${id}`).then(r => r.data),

  move: (data: MoveEquipmentDTO) =>
    api.post('/equipments/move', data).then(r => r.data),

  swap: (data: SwapEquipmentDTO) =>
    api.post('/equipments/swap', data).then(r => r.data),

  getTypes: () =>
    api.get<EquipmentType[]>('/equipments/types').then(r => r.data),

  getStatuses: () =>
    api.get<EquipmentStatus[]>('/equipments/statuses').then(r => r.data),

  // Opcional: lista de marcas de equipamentos exposta pelo backend.
  // Endpoint sugerido: GET /equipments/brands → string[]
  getBrands: () =>
    api.get<string[]>('/equipments/brands').then(r => r.data),

  getKpis: () =>
    api.get<DashboardStatsDTO>('/equipments/stats/kpi').then(r => r.data),

  getSectorStats: () =>
    api.get<SectorMetricDTO[]>('/equipments/stats/sectors').then(r => r.data),

  // Defeitos de equipamento
  getDefects: (equipmentId: string, params?: { status?: 'ABERTO' | 'RESOLVIDO'; year?: number; month?: number }) =>
    api.get<DefectResponse[]>(`/equipments/${equipmentId}/defects`, { params }).then(r => r.data),

  createDefect: (equipmentId: string, data: CreateDefectRequest) =>
    api.post<DefectResponse>(`/equipments/${equipmentId}/defects`, data).then(r => r.data),

  updateDefect: (equipmentId: string, defectId: string, data: CreateDefectRequest) =>
    api.put<DefectResponse>(`/equipments/${equipmentId}/defects/${defectId}`, data).then(r => r.data),

  resolveDefect: (equipmentId: string, defectId: string) =>
    api.patch<DefectResponse>(`/equipments/${equipmentId}/defects/${defectId}/resolve`).then(r => r.data),
};
