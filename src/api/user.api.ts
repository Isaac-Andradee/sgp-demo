import { api } from './client';
import type { UserResponse, CreateUserRequest, CreateUserResponse, UpdateUserRequest, PagedResponse, AdminResetPasswordResponse, RecoveryCodeResponse, SecurityStatusResponse } from '../types';

export const userApi = {
  list: (page = 0, size = 10) =>
    api.get<PagedResponse<UserResponse>>('/users', { params: { page, size } }).then(r => r.data),

  get: (id: string) =>
    api.get<UserResponse>(`/users/${id}`).then(r => r.data),

  create: (data: CreateUserRequest) =>
    api.post<CreateUserResponse>('/users', data).then(r => r.data),

  update: (id: string, data: UpdateUserRequest) =>
    api.put<UserResponse>(`/users/${id}`, data).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/users/${id}`).then(r => r.data),

  /** Camada 1 — Reset por admin: gera senha temporária (exibida uma única vez). */
  resetPassword: (id: string) =>
    api.post<AdminResetPasswordResponse>(`/users/${id}/reset-password`).then(r => r.data),

  /** Camada 2 — Gera (ou regenera) o código de recuperação de uma conta ADMIN/DEV. */
  generateRecoveryCode: (id: string) =>
    api.post<RecoveryCodeResponse>(`/users/${id}/recovery-code`).then(r => r.data),

  /** Camada 1 — Situação de recuperação de acesso (alerta de 2º admin). */
  securityStatus: () =>
    api.get<SecurityStatusResponse>('/users/security-status').then(r => r.data),
};
