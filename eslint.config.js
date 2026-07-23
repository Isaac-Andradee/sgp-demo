import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Padrões de sincronização de estado derivado via useEffect são usados de
      // forma intencional e testada em vários pontos — mantemos como aviso.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // Componentes vendorizados (shadcn/ui) — exportam helpers/variants junto dos
  // componentes e usam padrões que as regras do React Compiler não entendem.
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'react-hooks/purity': 'off',
    },
  },
  // Contextos e o arquivo de rotas exportam hooks/wrappers ao lado dos
  // componentes por design (Fast Refresh não se aplica a esses módulos).
  {
    files: ['src/contexts/**/*.{ts,tsx}', 'src/routes.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
