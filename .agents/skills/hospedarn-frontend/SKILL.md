---
name: hospedarn-frontend
description: "Implementação e qualidade do frontend HospedaRN (React 19 + MUI 9 + Vite 8 + React Router 7 + TanStack Query + Zustand): camada de dados/hooks, tipos e contrato da API, formulários RHF+zod, design system/tema, acessibilidade WCAG, responsividade e performance das telas de hóspede, estabelecimento e gestor. Carregue para qualquer alteração em frontend/src."
---

# HospedaRN — frontend

## 1. Escopo

Objetivo: entregar telas que funcionam de verdade (dado certo, estado de erro, acessível e rápida),
sem replicar regra de negócio que pertence ao servidor.

```
frontend/**   (src, index.html, package.json, tsconfig.json; criar vite.config.ts quando necessário)
```

Não altera `backend/**`. Se faltar campo/rota na API, pede ao `hospedarn-backend`/`hospedarn-arquiteto`
(o contrato é definido antes).

## 2. Realidade do código (não presuma o contrário)

- Existem **4 componentes** (`PublicLayout`, `DashboardLayout`, `ProfileSettings`) + `theme/index.ts`.
  Não existe `src/types`, `vite.config.ts`, nem `src/components/{auth,common,...}`.
- **27 páginas**, 5 delas stubs (`EstPrices`, `EstReports`, `EventsPage`, `GuestProfile`, `AdminProfile`).
- React Query em 4 telas; **17 usam `useEffect` + axios**. Zero `useMutation` e zero `invalidateQueries`.
- `services/api.ts` centraliza os recursos (`reservationsApi`, `paymentsApi`, ...) e faz refresh em 401.
- Vocabulário: `role: 'GUEST'|'ESTABLISHMENT'|'ADMIN'` no front × `perfil: 'HOSPEDE'|'ESTABELECIMENTO'|'ADMIN'` no back;
  a tradução está em `LoginPage`/`RegisterPage` e não é compartilhada.
- `tsconfig` sem `strict`; `noUnusedLocals/Parameters: false` esconde imports mortos.

## 3. Prioridades e riscos do escopo

| ID | Item | Evidência |
|---|---|---|
| **R-17** | **Dois formulários de cartão fictícios** coletam PAN/CVV em estado React e "confirmam" pagamento sem cobrança | `pages/guest/GuestReservations.tsx:481-519,1440-1498`, `pages/public/EstablishmentDetailPage.tsx:93-98,292-299` |
| R-18 | Tokens em `localStorage`, `logout()` sem revogar refresh, `processQueue` não resolve em falha | `stores/authStore.ts:30-77`, `services/api.ts:72-95` |
| R-28 | `AdminUsers.tsx` × `EstUsers.tsx` 89% idênticos | `pages/admin/AdminUsers.tsx`, `pages/establishment/EstUsers.tsx` |
| R-29 | Contraste AA reprovado (`#0097A7` 3.51:1, `#FF7043` 2.74:1), `lang="en"`, zero `aria-label` | `theme/index.ts:21`, `index.html:2` |
| R-30 | Hóspede baixa 1000 reservas e pagina no cliente + polling de 15 s com `syncMP` por reserva | `GuestReservations.tsx:226,239-256` |
| R-32 | Sem `src/types`; 6 `interface Establishment`, 4 `Reservation`; helpers duplicados | várias páginas |

R-17 é **bloqueante de segurança**: remova a coleta de cartão e o caminho "simulado" que marca pagamento;
se o estabelecimento é `PADRAO`, a UI deve orientar comprovante/PIX instrucional; se é `MERCADO_PAGO`,
o botão gera o checkout real (`paymentsApi.createCheckoutMP`) e redireciona/abre o QR.

## 4. Padrões alvo (implemente incrementalmente, sem big bang)

1. **Dados**: um hook por recurso (`useMinhasReservas`, `useMeuEstabelecimento`, `useCidades`) com
   `queryKey` factory; `useMutation` + `invalidateQueries`; nada de polling manual para dado que o
   usuário pode atualizar (botão "atualizar" + foco da janela).
2. **Desembrulho do envelope**: hoje `res.data.data || res.data` aparece em ~28 lugares. Centralize no
   `api` (interceptor de resposta) ou em um `unwrap<T>()` tipado; mantenha compatibilidade durante a migração.
3. **Tipos**: criar `src/types/{api,domain}.ts` espelhando DTOs do backend (`Reserva`, `Pagamento`,
   `Estabelecimento`, `Quarto`, `Usuario`) e um único mapper `perfil → role`.
4. **Formulários**: RHF + zod em todas as telas de gestor; schemas em `src/schemas/`; não replicar
   regra que o backend já aplica (preço é server-side).
5. **Design system**: usar tokens do tema (`theme/index.ts`); proibido `#hex`/`fontFamily` inline em
   código novo. Corrigir contraste para AA (≥4.5:1 texto normal) ajustando `primary`/`secondary`.
6. **Acessibilidade**: `aria-label` em todo `IconButton` só com ícone, `alt` em imagens, `lang="pt-BR"`,
   foco visível, navegação por teclado nos diálogos, labels associadas.
7. **Performance**: `React.lazy` + `Suspense` para leaflet/recharts; debounce na busca (hoje dispara por
   tecla); paginação server-side nas reservas do hóspede; `useMemo`/`memo` só onde houver medição.
8. **Erros**: `ErrorBoundary` na raiz; feedback ao usuário em toda chamada que pode falhar (hoje 72
   `console.error` sem toast).

## 5. Como trabalhar

1. Carregue `hospedarn-contexto`; abra a página **e** o `api.ts`; identifique o contrato real da rota.
2. Rode `npm run dev` e valide a tela no navegador (não entregue só compilando).
3. Antes de entregar: `npm run build` (roda `tsc`) e revisão visual nas 3 larguras (320/768/1024+).
4. Mudança de contrato de API → avise o arquiteto/backend e atualize os tipos.
5. Atualize o registro de riscos.

## 6. Critérios de qualidade

- `npm run build` passa; sem `any` novo; sem `console.log`.
- Nenhuma tela nova sem estado de carregamento, erro e vazio.
- Nenhum hex/fonte inline introduzido; contraste AA no que tocar.
- Nenhum dado sensível em `localStorage` além do já existente (e R-18 tem plano).
- Textos em pt-BR, coerentes com o restante do produto.

## 7. Limitações

- Não altera backend, schema ou contrato sem acordo.
- Não instala dependência (ex.: vitest/playwright) sem aprovação do usuário.
- Não "conserta" regra de negócio no cliente (ex.: esconder botão em vez de barrar no servidor).
- Não remove tela/stub sem confirmar com o usuário o destino do fluxo.

## 8. Interação e entregáveis

Handoff com: telas/rotas alteradas, contrato usado, evidência visual (print ou descrição do cenário),
build, riscos residuais. Depende de `hospedarn-backend`/`reservas`/`pagamentos` (contrato),
`hospedarn-qa` (teste de componente quando houver runner), `hospedarn-arquiteto` (decisão de fluxo).

## 9. Ferramentas

`read`, `grep`, `glob`, `edit`, `write` (só em `frontend/**`), `pwsh` para `npm run dev` e
`npm run build`. Nunca `npm install` (dependência nova exige aprovação do usuário), nunca editar
`backend/**`, nunca rodar `prisma` ou deploy.
