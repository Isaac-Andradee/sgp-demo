import { api } from './client';
import type { LoginRequest, LoginResponse, SetupRequest, SetupResponse, SuggestedUsernamesResponse, UserResponse, ChangePasswordRequest, RecoverWithCodeRequest } from '../types';

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', data).then(r => r.data),

  logout: () =>
    api.post('/auth/logout').then(r => r.data),

  me: () =>
    api.get<UserResponse>('/auth/me').then(r => r.data),

  /** O próprio usuário atualiza seu nome de exibição (PUT /auth/me). */
  updateProfile: (data: { fullName: string }) =>
    api.put<UserResponse>('/auth/me', data).then(r => r.data),

  /** Sugestões de login disponíveis a partir do nome completo (endpoint público). */
  suggestedUsernames: (fullName: string) =>
    api.get<SuggestedUsernamesResponse>('/auth/suggested-usernames', { params: { fullName: fullName.trim() } }).then(r => r.data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', null, { params: { email } }).then(r => r.data),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', null, { params: { token, password } }).then(r => r.data),

  /** Camada 2 — Recupera o acesso via código de uso único (endpoint público). */
  recoverWithCode: (data: RecoverWithCodeRequest) =>
    api.post('/auth/recover-with-code', data).then(r => r.data),

  setup: (data: SetupRequest) =>
    api.post<SetupResponse>('/setup', data).then(r => r.data),

  changePassword: (userId: string, data: ChangePasswordRequest) =>
    api.post(`/users/${userId}/change-password`, data).then(r => r.data),
};
