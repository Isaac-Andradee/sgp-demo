import { useEffect } from "react";

const APP_NAME = "SGPT Demo";

/**
 * Atualiza o título da aba do navegador.
 * Formato: "Nome da Página | SGPT Demo"
 * Se nenhum título for passado, exibe apenas "SGPT Demo".
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
