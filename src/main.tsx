import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import './styles/fonts.css'
import './styles/theme.css'
import './styles/tailwind.css'
import './styles/index.css'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { Toaster } from './components/ui/sonner'
import { ErrorBoundary } from './components/error-boundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry com backoff exponencial (1s, 2s, 4s) — máximo 3 tentativas
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      staleTime: 30_000,
    },
    mutations: {
      // Mutations nunca fazem retry automático (evita efeitos colaterais duplicados)
      retry: 0,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="sgp-theme">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
