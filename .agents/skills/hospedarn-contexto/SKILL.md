---
name: hospedarn-contexto
description: "Base de conhecimento compartilhada do projeto HospedaRN (NestJS 11 + Prisma/Postgres + React 19/MUI). Carregue ANTES de qualquer tarefa no repositório HospedaRN: mapa de módulos, contratos reais da API, invariantes de negócio, convenções de código e fatos do ambiente que enganam (scripts quebrados, testes que não rodam, armadilhas de deploy)."
---

# HospedaRN — contexto compartilhado

Fonte única de fatos do projeto. Todo agente do time carrega esta skill primeiro e só depois a
sua especialidade. Se algo aqui divergir do código, **o código vence**: registre a divergência no
handoff — só o `hospedarn-arquiteto` edita este arquivo.

## 1. O produto

Marketplace de hospedagens do Rio Grande do Norte. Três atores:

- **Hóspede** (`HOSPEDE`): busca cidade → estabelecimento → quarto → solicita reserva → paga.
- **Estabelecimento** (`ESTABELECIMENTO`): confirma/cancela reservas, gerencia quartos, preços, fotos, regras, sub-usuários.
- **Gestor** (`ADMIN`): cidades, estabelecimentos, eventos, relatórios globais, `modoPagamento` do estabelecimento.

Fluxo canônico da reserva:

```
SOLICITADA --(estabelecimento confirma)--> CONFIRMADA
   |                                            |
   |                                    modo PADRAO: comprovante + aprovação manual
   |                                    modo MERCADO_PAGO: pagamento automático
   v                                            v
CANCELADA <--- (hóspede/estabelecimento) --- AGUARDANDO_PAGAMENTO / FINALIZADA
```

`modoPagamento` (`PADRAO` | `MERCADO_PAGO`) é **por estabelecimento** e fica **congelado na
reserva** na criação (`Reserva.modoPagamento`): trocar a configuração depois não altera
reservas existentes. Regra completa: `Regra_Pagamento_Mercado_Pago.md` (raiz).

## 2. Stack (versões reais)

| Camada | Tecnologia |
|---|---|
| Backend | NestJS 11, Prisma 6, PostgreSQL (Neon) + **PostGIS**, JWT (`passport-jwt`), BullMQ + Redis, Resend (HTTP), S3 (`@aws-sdk/client-s3`) + `sharp`, Mercado Pago SDK `^3.6.1`, Swagger, Throttler, helmet |
| Frontend | React 19, MUI 9 (`@mui/material`, x-data-grid, x-date-pickers), Vite 8, React Router 7, TanStack Query 5, Zustand 5, axios, react-hook-form + zod 4, leaflet/react-leaflet, recharts, dayjs, TypeScript ~6 (sem `strict`) |
| Dev local | backend `:3000` (prefixo `/api`, Swagger em `/docs`), frontend `:5173`, Redis `:6379` via `docker-compose.yml` |

Comandos reais:

```powershell
# backend (D:\Documentos\projects\HospedaRN\backend)
npm run start:dev        # nest start --watch
npm run build            # nest build  (é o gate de compilação)
npm run lint             # eslint --fix
npm test                 # jest, rootDir src, testRegex .*\.spec\.ts$
npm run test:e2e         # jest --config ./test/jest-e2e.json  (hoje QUEBRADO, ver R-19)
npx prisma generate
npx prisma migrate dev --name <slug>    # dev
npx prisma migrate deploy               # prod (nunca db push --accept-data-loss)

# frontend (D:\Documentos\projects\HospedaRN\frontend)
npm run dev              # vite
npm run build            # tsc && vite build  (hoje tsc sem strict)
```

## 3. Mapa do backend (`backend/src`)

`app.module.ts` monta 20 módulos; guards globais (`JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`)
são declarados dentro de `auth.module.ts`. Envelope de toda resposta:
`{ success, data, timestamp }` (`common/interceptors/transform.interceptor.ts`).

| Módulo | Dono do código | O que faz |
|---|---|---|
| `auth` | hospedarn-seguranca | register/login/refresh/logout/forgot/reset; JWT payload **só** `{sub,email,perfil}` |
| `usuarios` | hospedarn-backend | perfil, troca de senha, sub-usuários com `permissoes`/`subPerfil` |
| `cidades`, `estabelecimentos`, `comodidades`, `tipos-acomodacao`, `quartos`, `fotos`, `regras`, `eventos`, `avaliacoes`, `favoritos`, `maps`, `reports`, `uploads`, `notifications`, `audit` | hospedarn-backend | CRUD, catálogo, mídia, BI, e-mail |
| `reservas` + disponibilidade/preço de `quartos` | hospedarn-reservas | ciclo de vida da reserva |
| `pagamentos`, `mercado-pago` | hospedarn-pagamentos | cobrança manual e MP, webhook, reconhecimento |
| `backend/prisma/**` | hospedarn-dados | schema, migrations, índices, constraints |
| `common/**` (guards, decorators, filters, interceptors) | hospedarn-seguranca | autorização e hardening transversal |

Modelos Prisma: `Usuario, Cidade, Estabelecimento, Comodidade, EstabelecimentoComodidade,
TipoAcomodacao, Quarto, Temporada, PrecoQuarto, Foto, Reserva, Pagamento, Evento, EventoCidade,
Avaliacao, Favorito, LogAuditoria, BloqueioData, Hospede, RegraSecao, RegraTopico`.

## 4. Mapa do frontend (`frontend/src`) — o que realmente existe

- Só **4 componentes**: `components/layout/PublicLayout.tsx`, `components/layout/DashboardLayout.tsx`, `components/profile/ProfileSettings.tsx` (+ `theme/index.ts`).
- **Não existe `src/types`**, nem `vite.config.ts`. Tipos são `interface` locais nas páginas.
- 27 páginas em `pages/{public,guest,establishment,admin}` — **5 são stubs** (`EstPrices`, `EstReports`, `EventsPage`, `GuestProfile`, `AdminProfile`).
- React Query só em 4 telas; as outras usam `useEffect` + axios. **0 `useMutation`, 0 `invalidateQueries`**.
- `services/api.ts` é o único cliente: interceptor injeta o access token, fila de refresh em 401, e agrupa todos os recursos (`reservationsApi`, `paymentsApi`, ...).
- Bootstrap de estabelecimento (`getMy()` + fallback) está repetido em 5 telas.
- Vocabulário divergente: frontend usa `role: 'GUEST' | 'ESTABLISHMENT' | 'ADMIN'`; backend usa `perfil: 'HOSPEDE' | 'ESTABELECIMENTO' | 'ADMIN'`. A tradução é manual em `LoginPage`/`RegisterPage`.

## 5. Invariantes de negócio (não quebre sem decisão explícita do usuário)

1. **Preço é server-side**: o cliente nunca envia `valorTotal`; `roomsApi.calculatePrice` calcula e `ReservationsService.create` grava.
2. **Cidade do estabelecimento só o ADMIN altera**; o estabelecimento edita o resto do próprio perfil.
3. **Gestor aprova cadastro de estabelecimento** antes do primeiro acesso (backend não implementa esse gate hoje — divergência conhecida, não "corrija" sem plano).
4. **Pagamento nunca coleta dados de cartão no nosso servidor**: cartão vai pelo Checkout Pro (`initPoint`).
5. **Modo PADRAO** exige comprovante e aprovação manual; **modo MERCADO_PAGO** dispensa comprovante e reconhece sozinho.
6. **Reserva não muda de modo** depois de criada (snapshot).
7. **Hóspede só cancela** em `SOLICITADA` / `AGUARDANDO_PAGAMENTO` pela UI; o backend aceita mais — divergência sob análise (R-06, R-15).
8. Auditoria (`LogAuditoria`) é requisito (RNF-07) e hoje não é usada.

## 6. Armadilhas do ambiente (fatos que enganam)

- `.start/backend.bat` roda `npm start dev` — script inexistente; quebra. Use `npm run start:dev`.
- `backend/package.json:15` (`start:prod`) roda `prisma db push --accept-data-loss`: **destrutivo**. Nunca reproduza isso localmente.
- `backend/.env` existe e tem credenciais reais (Neon, AWS, Resend, MP sandbox). **Nunca** imprima valores, nunca versione, nunca use em teste automatizado.
- `backend/test/app.e2e-spec.ts` falha por causa do envelope da API (R-19).
- `frontend` não tem `.env`; em dev `window.__ENV__` é `undefined` e `api.ts` cai no fallback `http://localhost:3000/api`.
- `frontend/src/main.ts`, `counter.ts`, `style.css` são sobras do template Vite.
- `git status` hoje traz `probe-mp.cjs`, `probe-mp2.cjs`, `query_db.js`, `refactor_backend.js`, PNGs e um `package.json` de raiz com `mercadopago`: lixo, não base de código.
- Windows + **PowerShell 5.1**: sem `pwsh`, sem `&&`. Comandos encadeados com `;`.
- **Nunca edite texto com `Get-Content`/`Set-Content` do PS 5.1**: ele lê como ANSI e regrava em UTF-8,
  corrompendo acentos (mojibake `Ã§`). Use as ferramentas `read`/`edit`/`write` do harness; PowerShell
  só para comandos (`git`, `npm`, `select-string`), nunca para reescrever conteúdo.

## 7. Fila de problemas verificados

`docs/agents/RISCOS-VERIFICADOS.md` — 34 itens com severidade, evidência `arquivo:linha` e agente
dono. Antes de "descobrir" um problema, procure o ID ali. Antes de corrigir, atualize o status.

## 8. Convenções

- **Idioma**: código/identificadores em português no domínio (`Reserva`, `hospedeId`, `checkIn`); infra em inglês (`PaymentsService`). Respostas ao usuário e comentários de decisão em pt-BR.
- **DTO**: `class-validator` + `@ApiProperty`; `ValidationPipe` global já tem `whitelist` + `forbidNonWhitelisted` — campo fora do DTO = 400.
- **Erros**: `HttpException` do Nest (`BadRequestException`, `ForbiddenException`, `NotFoundException`); nunca `throw new Error` para erro de cliente.
- **Dinheiro**: `Decimal` no banco, `Number()` na borda, nunca `float` acumulado.
- **Datas**: colunas `@db.Date` para estadia, `Timestamptz` para eventos; compare sempre em UTC e formate com `dayjs`.
- **Commits**: `feat:`, `fix:`, `refactor:`, `chore:` + escopo (padrão já usado no histórico).
- **Planos de feature**: `Implementations/ImplementationPlan_<slug>_ddmmaaaa.md` (formato do arquiteto).

## 9. Como verificar antes de afirmar

1. `grep` no código antes de supor comportamento (`select-string`/`rg` no repo).
2. Prefira ler o service **e** o controller do módulo: metade das regras está no controller.
3. Não há testes confiáveis: a evidência é leitura + `npm run build` + reprodução manual documentada.
4. Se não puder verificar, escreva **"não verificado"** no handoff — nunca apresente suposição como fato.

## 10. Ficha, limitações e ferramentas

**Objetivo:** ser o ponto de partida comum — nenhum agente deve redescobrir stack, invariantes ou
armadilhas do ambiente no meio da tarefa.

**Critérios de qualidade:** todo fato aqui é verificável no código; ao encontrar divergência, o agente
reporta no handoff com `arquivo:linha` e o `hospedarn-arquiteto` corrige. Nada de opinião ou "boa
prática" genérica nesta skill.

**Limitações:** é uma skill **de leitura** — nenhum agente a edita fora do `hospedarn-arquiteto`. Ela
não substitui a leitura do código: é o mapa, não o território.

**Ferramentas:** `read`, `grep`, `glob` e comandos read-only (`git log`, `git diff`, `select-string`).

**Interação:** é carregada por todos antes da especialidade; não conversa com outros agentes.

**Entregáveis:** nenhum artefato próprio — o valor é evitar retrabalho e erro de premissa.
