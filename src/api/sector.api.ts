import { api } from './client';
import type { SectorResponseDTO, CreateSectorDTO } from '../types';

export const sectorApi = {
  list: () =>
    api.get<SectorResponseDTO[]>('/sectors').then(r => r.data),

  get: (id: string) =>
    api.get<SectorResponseDTO>(`/sectors/${id}`).then(r => r.data),

  create: (data: CreateSectorDTO) =>
    api.post<SectorResponseDTO>('/sectors', data).then(r => r.data),

  update: (id: string, data: CreateSectorDTO) =>
    api.put<SectorResponseDTO>(`/sectors/${id}`, data).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/sectors/${id}`).then(r => r.data),
};
