# SGP — Sistema de Gestão de Patrimônio · Demonstração

> **Versão de portfólio.** Réplica navegável da interface de um sistema de gestão de patrimônio de
> TI em produção numa administração pública desde julho de 2026. **Todos os dados são fictícios** e
> **não há backend** — a API é simulada no próprio navegador.

**▶ Demonstração ao vivo:** [Demonstração](https://sgp-demo-delta.vercel.app/login)

---

## O problema

O controle de equipamentos de TI de uma unidade pública era feito em **planilha compartilhada**.
Planilha guarda dado, mas não garante as três coisas que o controle patrimonial exige:

| Limitação da planilha | Consequência | Como o sistema resolve |
|---|---|---|
| Não registra **quem** alterou nem **quando** | Impossível auditar | Trilha de auditoria com autor, ação, data e IP |
| Duas pessoas editando **se sobrescrevem** | Trabalho perdido em silêncio | Banco transacional + *optimistic locking* |
| **Não valida** a entrada | Patrimônio duplicado, dado inconsistente | Validação na aplicação + restrições no banco |
| Consulta e relatório **manuais** | Horas para levantar informação | Filtros, dashboard e relatórios em PDF |

---

## O que explorar na demonstração

A tela de login oferece **três perfis**. Vale entrar em mais de um: o controle de acesso é a
parte do sistema que menos aparece em captura de tela.

| Perfil | O que enxerga |
|---|---|
| **Consulta** (`VIEWER`) | Somente leitura — os botões de escrita desaparecem |
| **Operador** (`USER`) | Cadastra, movimenta e troca equipamentos |
| **Administrador** (`ADMIN`) | Tudo, mais usuários, setores, relatórios e auditoria |

A faixa amarela do topo permite **trocar de perfil a qualquer momento** e **resetar os dados**.

> O sistema real tem um quarto perfil, `DEV`, com a Central de Manutenção e a inspeção do
> ambiente. Ele foi **deixado de fora desta demonstração** de propósito, junto com a tela e as
> rotas correspondentes.

### Roteiro sugerido (3 minutos)

1. **Dashboard** — totais por situação e distribuição por setor.
2. **Movimentação → Trocar equipamento** — a operação central do sistema (ver abaixo).
3. **Auditoria** — o registro da troca que você acabou de fazer, com autor, horário e IP.
   *É exatamente o que a planilha não fazia.*
4. **Relatórios** — gera um PDF de verdade, montado no navegador.
5. **Troque para o perfil Consulta** pela faixa do topo e repare no que some da interface.

---

## Regras de negócio implementadas

A demo não é uma casca com dados estáticos: as regras que dão sentido ao sistema foram
reimplementadas em memória.

### Troca de equipamento em campo (*swap*)

A operação mais frequente da equipe: *"a máquina do fulano quebrou, levo outra, instalo e trago a
defeituosa"*. Em qualquer sistema de inventário genérico isso são de três a cinco lançamentos
desconectados — e alguém sempre esquece um. Aqui é **uma** operação atômica:

1. O equipamento **novo** assume setor, status `EM_USO` e responsável do antigo.
2. O **antigo**, se defeituoso, abre um registro de defeito e vai para o estoque em `MANUTENCAO`;
   se não, volta ao setor de origem do novo (`DISPONIVEL` se for o estoque, `EM_USO` caso contrário).

### Status inicial derivado do contexto (Strategy)

Ao cadastrar sem informar o status, o sistema o deduz:

| Condição | Status |
|---|---|
| Sem número de patrimônio | `PROVISORIO` |
| Com patrimônio, destino = almoxarifado de TI | `DISPONIVEL` |
| Com patrimônio, outro setor | `EM_USO` |

### Outras regras ativas

- **Limpeza de responsável** — mover para `DISPONIVEL`, `MANUTENCAO`, `INSERVIVEL` ou `BAIXADO`
  limpa o responsável. Impede o estado "máquina na oficina, mas ainda atribuída ao João".
- **Defeito preserva o status anterior** — ao resolver, o equipamento volta ao estado em que
  estava, em vez de um valor arbitrário.
- **Patrimônio único** — cadastro duplicado é bloqueado com mensagem clara.
- **Login padronizado** `nome.sobrenome`, com sufixo numérico em caso de colisão.
- **Auditoria** — toda operação relevante gera registro imutável.

---

## Como a demo funciona sem backend

O sistema real é um **SPA React** conversando com uma **API REST em Spring Boot**. Aqui, a API foi
substituída por um *adapter* do axios:

```ts
// src/api/client.ts
api.defaults.adapter = demoAdapter;   // resolve tudo em memória, sem tocar a rede
```

Isso foi possível por uma decisão de arquitetura do projeto original: **todas as chamadas passam
por uma única instância axios**, e nenhum componente chama `axios` diretamente. Trocar o adapter
intercepta os 8 módulos de API de uma vez — **os componentes, hooks, guards e o TanStack Query não
mudaram uma linha**.

```
src/demo/
├── adapter.ts    roteador método+rota → store (substitui os controllers)
├── store.ts      estado + regras de negócio + auditoria (substitui os use cases)
├── seed.ts       dados fictícios determinísticos (68 equipamentos, 8 setores, 6 usuários)
├── pdf.ts        gerador mínimo de PDF (substitui o OpenPDF do backend)
├── DemoBanner.tsx        faixa de topo: troca de perfil e reset
└── DemoAccountPicker.tsx acesso rápido na tela de login
```

Detalhes que fazem a demo se comportar como o sistema real:

- **`validateStatus` é respeitado** pelo adapter, então os interceptors globais de `401` e `503`
  continuam funcionando como em produção.
- **Latência artificial** de 120–340 ms — sem ela os estados de carregamento nunca apareceriam.
- **Persistência em `localStorage`** — o que você cadastrar sobrevive ao recarregamento.
- **Seed determinístico** (PRNG com semente fixa) — os dados são idênticos a cada visita.

---

## Stack

| Camada | Tecnologia |
|---|---|
| UI | React 19 · TypeScript 5.9 · Vite 7 |
| Roteamento | React Router 7 (`createBrowserRouter`) |
| Estado do servidor | TanStack Query 5 |
| HTTP | Axios (com adapter de demonstração) |
| Formulários | React Hook Form + Zod |
| Estilo | Tailwind CSS v4 · tema claro/escuro |
| Componentes | Radix UI no padrão shadcn/ui (46 componentes) |
| Gráficos | Recharts |

**O sistema real** roda em Spring Boot 4 · Java 21 · PostgreSQL 16, com JWT em cookie `httpOnly`,
Argon2, Flyway, **1.068 testes automatizados** (531 no backend, 537 no frontend) com gate de
cobertura no CI — 95,3% de linhas no backend e 94,7% no frontend —, CI/CD via GitHub Actions e
GHCR, e backup diário automatizado.

> Esta demonstração **não tem testes**: ela é uma vitrine estática do sistema, com backend
> simulado no navegador (ver [Como a demo funciona sem backend](#como-a-demo-funciona-sem-backend)).
> A suíte vive nos repositórios do sistema real.

---

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:5173
```

Não precisa de backend, banco nem variável de ambiente.

```bash
npm run build    # type-check + build de produção
npm run lint     # ESLint
```

---

## Publicando

O projeto é estático. Em qualquer host com *fallback* de SPA (Vercel, Netlify, Cloudflare Pages),
basta apontar para o repositório — o `vercel.json` já traz o *rewrite* necessário para que
recarregar `/movimentacao` funcione.

Variáveis opcionais (ver `.env.example`): `VITE_APP_VERSION` e `VITE_REPO_URL` (exibe o botão
"Código" na faixa de demonstração).

---

## Aviso

Esta é uma **reprodução para fins de portfólio**. Setores, pessoas, números de patrimônio, números
de série e endereços IP são **inventados**. Nenhum dado real de qualquer órgão foi usado, e nenhum
arquivo de infraestrutura, credencial ou configuração de produção faz parte deste repositório.

**Autor:** Isaac Andrade
