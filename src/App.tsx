import { RouterProvider } from "react-router";
import { router } from "./routes.tsx";
import { DemoBanner } from "./demo/DemoBanner";

export default function App() {
  return (
    <>
      {/* Faixa de demonstração: fica acima de todas as rotas, inclusive /login e /maintenance. */}
      <DemoBanner />
      <RouterProvider router={router} />
    </>
  );
}
