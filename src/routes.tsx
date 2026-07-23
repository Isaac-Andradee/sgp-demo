import { createBrowserRouter } from "react-router";
import { AppLayout } from "./components/app-layout";
import { LoginPage } from "./components/login-page";
import { DashboardPage } from "./components/dashboard-page";
import { MovimentacaoPage } from "./components/movimentacao-page";
import { SetoresPage } from "./components/setores-page";
import { SetupPage } from "./components/setup-page";
import { ResetPasswordPage } from "./components/reset-password-page";
import { RecoverWithCodePage } from "./components/recover-with-code-page";
import { MustChangePasswordPage } from "./components/must-change-password-page";
import { UsuariosPage } from "./components/usuarios-page";
import { RelatoriosPage } from "./components/relatorios-page";
import { PerfilPage } from "./components/perfil-page";
import { AuditoriaPage } from "./components/auditoria-page";
import { DevPage } from "./components/dev-page";
import { MaintenancePage } from "./components/maintenance-page";
import { ContaDesativadaPage } from "./components/conta-desativada-page";
import { HistoricoDefeitosPage } from "./components/historico-defeitos-page";
import { AuthGuard } from "./guards/AuthGuard";
import { RoleGuard } from "./guards/RoleGuard";
import { PublicGuard } from "./guards/PublicGuard";

function Auth({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {/* DEV herda todas as permissões de ADMIN — RoleGuard aceita ambos */}
      <RoleGuard requiredRole="ADMIN">{children}</RoleGuard>
    </AuthGuard>
  );
}

function DevOnly({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <RoleGuard requiredRole="DEV">{children}</RoleGuard>
    </AuthGuard>
  );
}

function Public({ children }: { children: React.ReactNode }) {
  return <PublicGuard>{children}</PublicGuard>;
}

export const router = createBrowserRouter([
  // Tela de manutenção: acessível por qualquer um, sem autenticação
  { path: "/maintenance", Component: MaintenancePage },

  // Conta desativada: usuário foi barrado com 401; chama POST /logout para limpar cookie
  { path: "/conta-desativada", Component: ContaDesativadaPage },

  // Rota de setup: acessível apenas quando banco está vazio
  { path: "/setup", Component: SetupPage },

  // Rotas públicas: redirecionam para /setup se banco vazio, ou para / se já autenticado
  { path: "/login", element: <Public><LoginPage /></Public> },
  { path: "/reset-password", Component: ResetPasswordPage },
  // Recuperação por código (Camada 2) — pública, para admins sem acesso
  { path: "/recuperar-acesso", element: <Public><RecoverWithCodePage /></Public> },
  // Troca obrigatória de senha (senha temporária) — autenticada, fora do layout principal
  { path: "/trocar-senha", element: <Auth><MustChangePasswordPage /></Auth> },

  // Rotas autenticadas
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, element: <Auth><DashboardPage /></Auth> },
      { path: "movimentacao", element: <Auth><MovimentacaoPage /></Auth> },
      { path: "historico-defeitos", element: <Auth><HistoricoDefeitosPage /></Auth> },
      { path: "setores", element: <Auth><SetoresPage /></Auth> },
      { path: "usuarios",  element: <AdminOnly><UsuariosPage /></AdminOnly>  },
      { path: "relatorios", element: <AdminOnly><RelatoriosPage /></AdminOnly> },
      { path: "auditoria", element: <AdminOnly><AuditoriaPage /></AdminOnly> },
      { path: "dev",       element: <DevOnly><DevPage /></DevOnly>           },
      { path: "perfil",    element: <Auth><PerfilPage /></Auth>              },
    ],
  },
]);
