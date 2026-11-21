# ADR-002 — Check-out como entidade aditiva e `FINALIZADA` como consequência do encerramento

- **Data:** 2026-11-20
- **Status:** aceita
- **Decisores:** contrato fixado pelo usuário/lead (`hospedarn-coordenador`); `hospedarn-arquiteto` registra, valida no código e detalha as consequências
- **Numeração:** `002` — sequencial ao `ADR-001` (a convenção não permite reaproveitar número)
- **Plano relacionado:** `Implementations/ImplementationPlan_CheckoutEstabelecimento_20112026.md`
- **Contrato:** `docs/api/checkout.md` · **Fluxo:** `docs/flows/checkout.md` · **ADR anterior:** [ADR-001](ADR-001-checkin-entidade-aditiva.md)

## Contexto

O módulo do Estabelecimento precisa registrar o **encerramento da hospedagem** (check-out): quando a
saída aconteceu, quem a recebeu e o que ficou anotado — com a mesma trilha de auditoria do check-in
(`LogAuditoria`, RNF-07). Hoje a única coisa parecida é a data prevista `Reserva.checkOut`
(`backend/prisma/schema.prisma:269-270`), que é planejamento, não realização.

O caminho "óbvio" — tratar `status = FINALIZADA` como "estadia encerrada" — está bloqueado por fatos do
código, não por preferência:

1. **`FINALIZADA` nasce antes da estadia, por dois caminhos e sem relação com data:**
   (a) aprovação de pagamento no Mercado Pago (`backend/src/modules/pagamentos/pagamentos.service.ts:628-630`
   define `deveFinalizar` para `CONFIRMADA`/`AGUARDANDO_PAGAMENTO`, `:646-651` grava `FINALIZADA`);
   (b) `PATCH /reservas/:id/finalize` manual (`backend/src/modules/reservas/reservas.service.ts:289-299`),
   que aceita `CONFIRMADA`/`AGUARDANDO_PAGAMENTO` sem olhar período. Nenhum dos dois depende de a data de
   saída ter chegado.
2. **O produto diz outra coisa:** a especificação descreve `FINALIZADA` como "pagamento confirmado e
   concluída (após data de saída)" (`Documento_Especificacao_Requisitos.md:124`) — divergência entre
   documento e código **já registrada** (ADR-001) e **não resolvida** por este ADR.
3. **A disponibilidade depende de `FINALIZADA`:** `checkAvailability` bloqueia
   `SOLICITADA, CONFIRMADA, AGUARDANDO_PAGAMENTO, FINALIZADA`
   (`backend/src/modules/quartos/quartos.service.ts:80-82`) — foi a correção do overbooking do modo
   Mercado Pago (**R-06**). Mexer no significado do status mexe em disponibilidade, que é regra de negócio.
4. **Não existe status de quarto/limpeza:** o model `Quarto` só tem `ativo` e dados cadastrais
   (`backend/prisma/schema.prisma:193-215`); disponibilidade é **derivada** de `Reserva` + `BloqueioData`
   (`quartos.service.ts:73-101`). O check-out não pode inventar um eixo de situação de quarto.
5. **A rota de finalização não é confiável como encerramento:** `PATCH /reservas/:id/finalize` não checa
   dono (**R-08**, aberto — `reservas.controller.ts:94-98`, `reservas.service.ts:289-299`), não guarda
   horário de saída, responsável nem observações, e não gera auditoria.

Resumindo: "finalizada" (eixo comercial/pagamento) e "estadia encerrada" (eixo operacional) não são o
mesmo estado e não compartilham a mesma máquina.

## Decisão

O encerramento da hospedagem é registrado em uma **entidade aditiva**: `CheckOut`, **1:1 com `Reserva`**
(`reservaId @unique`), com `realizadoEm` (`Timestamptz`, default `now()`), `responsavelId` (nullable, FK
`Usuario` com `ON DELETE SET NULL`), `observacoes` e `criadoEm`/`atualizadoEm`
(`backend/prisma/schema.prisma:404-418`). `StatusReserva` **não muda** (segue com os 5 valores comerciais,
`schema.prisma:25-31`) e `Quarto` **não ganha campo de situação**.

**"Estadia encerrada" passa a significar a existência de um `CheckOut`** — nunca `status = FINALIZADA`.
Ao concluir o check-out, a reserva passa para `FINALIZADA` (semântica "concluída"), na mesma transação,
sem alterar nenhum outro campo; a transição só é executada se o status ainda não for `FINALIZADA`. A
situação operacional (`HOSPEDADO` | `SAIDA_HOJE` | `ATRASADO` | `REALIZADO`) e a elegibilidade são
**derivadas** em toda leitura, nunca persistidas.

Decisões decorrentes, detalhadas como `D-n` no plano:

- **Elegibilidade (D-3):** precedência `RESERVA_CANCELADA` → `CHECKIN_NAO_REALIZADO` →
  `CHECKOUT_JA_REALIZADO` (resposta `409`) → elegível. **Sem** bloqueio por data (antecipado e após o
  previsto são permitidos) e **sem** bloqueio por pagamento pendente.
- **Texto × código (D-4):** `motivoInelegibilidade` em pt-BR para exibição e `codigoInelegibilidade`
  estável para máquina — mesmo padrão do check-in (D-6 do ADR-001).
- **Financeiro somente leitura (D-6):** `valorPago` = valor do `Pagamento` quando `status = CONFIRMADO`,
  senão `0`; `saldoEmAberto = max(0, valorTotal - valorPago)`. Zero cobrança, zero estorno, zero escrita
  em `Pagamento`.
- **Encerramento transacional (D-9):** `CheckOut` + `Reserva.status = FINALIZADA` (só se necessário) +
  `LogAuditoria` com `acao = 'CHECKOUT_REALIZADO'`, `entidade = 'Reserva'`, `usuarioId` (do JWT) e
  `enderecoIp`.
- **Duplicidade (D-10):** `CheckOut.reservaId @unique` + rechecagem dentro da `$transaction` + `P2002`
  convertido em `409`.
- **Rota paralela (D-11):** `PATCH /reservas/:id/finalize` continua existindo; o check-out **não** a usa
  e o **R-08 permanece aberto**.
- **Dia de referência único (D-13):** com `CheckOut`, a conferência usa o **dia operacional do check-out**;
  sem, usa **hoje** (`resolverDiaReferencia`). É a mesma base de `diasAposSaidaPrevista`, `saidaAntecipada`
  e da auditoria — sem isso o número "envelhecia" a cada dia (B-QA-2, R-45).
- **Gate dos avisos de saída (D-14):** `SAIDA_ANTECIPADA`/`SAIDA_APOS_PREVISTO` só existem quando há
  **estadia iniciada** (`CheckIn` ou `CheckOut`); reserva sem check-in recebe apenas os avisos financeiros
  (B-QA-1, R-44).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Reutilizar `FINALIZADA` como "estadia encerrada" (sem entidade nova) | `FINALIZADA` já é setada por pagamento aprovado e por rota manual, sem relação com a saída. Perde o carimbo temporal, o responsável e as observações; e a UI não teria como distinguir "pago" de "saiu" |
| Novo valor em `StatusReserva` (`EM_ESTADIA`/`ENCERRADA`) | Obriga a revisar todos os predicados: disponibilidade (`quartos.service.ts:80-82`, R-06), relatórios (`reports.service.ts:14,57`), pagamento e frontend. Estado linear único para dois eixos independentes (comercial × operacional); mesmo bloqueio já registrado no ADR-001 |
| Colunas em `Reserva` (`checkOutRealizado Boolean`/`dataSaidaReal DateTime`) | 2–3 colunas nulas em toda reserva, sem responsável/observações, e sem constraint que impeça duplicidade. Pior modelagem que a entidade 1:1 |
| Considerar `Reserva.checkOut` (`@db.Date`) como prova de saída | É a data **prevista**, não a realizada; não distingue saída antecipada de atrasada e não guarda autoria |
| Usar `PATCH /reservas/:id/finalize` como check-out | Sem checagem de dono (**R-08**), sem horário/autoria, sem auditoria; e mudaria o contrato de uma rota de outro dono. Fica como caminho paralelo, não como encerramento |
| FK obrigatória `CheckOut → CheckIn` (garantir "sem check-in não tem check-out" no banco) | Prisma não expressa 1:1 derivado de outra relação sem coluna extra; a regra fica no service (`CHECKIN_NAO_REALIZADO`, `400`) e a integridade real que importa (1 check-out por reserva) está no banco |
| **`CheckOut` aditivo 1:1 (escolhida)** | Uma responsabilidade por entidade; evento com carimbo de tempo + autor; enum comercial intocado → nenhum consumidor existente muda; duplicidade garantida por constraint; base para ocupação real no futuro |

## Consequências

- **Positivas:**
  - **Zero regressão** em disponibilidade/preço, relatórios, pagamento e frontend do hóspede:
    `StatusReserva` e seus predicados seguem idênticos.
  - `FINALIZADA` deixa de ser ambígua na prática: quem quiser "saiu de fato" consulta o `CheckOut`;
    quem quer "pago" continua lendo `status`.
  - Histórico fiel: `realizadoEm` (quando), `responsavelId` (quem), `observacoes` (o que ficou anotado) e
    `LogAuditoria` na mesma transação.
  - Duplicidade de check-out é invariante de banco (`CheckOut.reservaId @unique`), não só checagem de
    aplicação — fecha a corrida de duplo `POST`.
  - Check-out de reserva já `FINALIZADA` por pagamento é **permitido** (é justamente o caso comum do modo
    `MERCADO_PAGO`), o que seria impossível se `FINALIZADA` fosse a fonte de verdade.
  - Simetria com o check-in: a mesma forma de escopo, autorização, transação, auditoria e resposta —
    uma curva de aprendizado só para o time e para o frontend.
- **Negativas / custo:**
  - `FINALIZADA` passa a ter **duas leituras** no domínio ("paga" e "concluída"). Quem consumir apenas o
    status **não** distingue estadia encerrada — é preciso ler `CheckOut` (**R-41**). Mitigação: contrato
    documentado e avisos na UI; relatórios seguem comerciais (P-8).
  - **Check-out antecipado não libera as noites restantes**: a disponibilidade continua bloqueando
    `FINALIZADA` (`quartos.service.ts:80-82`, R-06). Consequência aceita e registrada como **R-40**;
    corrigir exige mudar `quartos/**` (decisão de produto, P-1).
  - A situação é **calculada** em toda leitura (comparações de data + existência de `CheckOut`), não é
    filtrável por índice como um enum. Mitigado pelo índice de escopo
    `Reserva(estabelecimentoId, checkIn, status)` (`schema.prisma:291`) e por `CheckOut_realizado_em_idx`
    (`prisma/sql/20261120_checkout.sql:45-46`).
  - A central só lista **hospedagem iniciada** (D-8): como o banco tem 0 `CheckIn` na data da entrega, a
    lista nasce vazia até a operação registrar os check-ins em curso (**R-42**).
  - Não há status de quarto/limpeza: o check-out **não** sinaliza "quarto pronto para governança". Fora
    de escopo por decisão (não existe o módulo) e registrado como lacuna.
  - As pré-checagens de elegibilidade ficam **fora** da `$transaction` (como no check-in): a unique protege
    duplicidade, não a corrida com cancelamento/check-in (**R-43**, espelho do R-36). Mitigação parcial:
    dentro da transação há rechecagem de duplicidade **e** releitura de `status`; a existência de `CheckIn`
    não é relida.
  - `PATCH /reservas/:id/finalize` (**R-08**, aberto) continua sendo um caminho de encerramento sem
    `CheckOut`, sem dono e sem auditoria — a ambiguidade convive com a feature até P-7.
- **Impacto em:**
  - **banco:** 1 tabela (`CheckOut`), 1 unique (`reserva_id`), 1 índice (`realizado_em`), 2 FKs. Aditivo,
    sem backfill, sem coluna alterada; DDL idempotente em `backend/prisma/sql/20261120_checkout.sql`,
    **aplicada no Neon** via `npx prisma db execute --file prisma/sql/20261120_checkout.sql` (**exit 0**,
    executada 2× para provar idempotência). Verificação real: `to_regclass('"CheckOut"')` existe, 2 índices
    (`CheckOut_reserva_id_key` UNIQUE, `CheckOut_realizado_em_idx`), 2 FKs (`CheckOut_reserva_id_fkey`,
    `CheckOut_responsavel_id_fkey`), 7 colunas e `prisma.checkOut.count() = 0`. Rollback:
    `DROP TABLE IF EXISTS "CheckOut";`. (O cabeçalho do `.sql` diz "nada foi aplicado durante a elaboração
    do artefato" — correto no momento em que foi escrito; a aplicação veio depois, pelo dono da
    persistência.)
  - **API:** 3 rotas novas (`GET /checkouts`, `GET /checkouts/:reservaId`, `POST /checkouts`), contrato em
    `docs/api/checkout.md`. Nenhuma rota existente muda de contrato nem de comportamento.
  - **backend:** implementação em `backend/src/modules/reservas/checkouts/**` +
    `backend/src/modules/reservas/reservas.module.ts:6-7,15-19,20` (registra `CheckoutsController` e
    `CheckoutsService` ao lado do check-in). `app.module.ts`/`main.ts` intocados (tag Swagger vem de
    `@ApiTags('Check-out')`).
  - **frontend:** página `/estabelecimento/checkout` (menu "Operação"), drawer de conferência e
    `checkoutsApi` (`frontend/src/services/api.ts:200-209`); reusa `components/common` e o padrão de
    `components/checkin/*`. Nenhuma tela existente muda de contrato.
  - **pagamento:** nenhuma mudança. O financeiro do check-out é somente leitura (D-6) e um pagamento
    pendente **não** bloqueia o encerramento.
  - **testes:** a matriz passa a cobrir status × check-in × check-out × datas, além de autorização/posse
    e concorrência (`P2002` → `409`). Execução de 20/11: **8 suites / 228 testes PASS** (126 pré-existentes
    + 102 novos: 81 de service + 21 de controller).

## Como validar

**Execução de 20/11/2026 (lead/QA/revisor):** `npx eslint "src/modules/reservas/checkouts/**/*.ts"` exit 0;
`cd backend; npm run build` exit 0; `cd frontend; npm run build` exit 0; `npm test` **8 suites / 228 testes
PASS**; DDL **aplicada** no Neon (exit 0, 2×); integração read-only real (`GET /checkouts` com
`TODOS=1`/`EM_ANDAMENTO=1`, `valorTotal` como `number`, `detail` de UUID inexistente → `404`); review do
revisor **aprovado com ressalvas, zero bloqueantes**. Reprodução:

1. **Modelo:** `SELECT to_regclass('"CheckOut"');` não nulo; `SELECT indexname FROM pg_indexes WHERE
   indexname = 'CheckOut_reserva_id_key';` 1 linha; `SELECT count(*) FROM "CheckOut" GROUP BY
   "reserva_id" HAVING count(*) > 1;` 0 linhas (1:1 garantido por unique).
2. **Enum intocado:** `git diff backend/prisma/schema.prisma` não mostra alteração em
   `enum StatusReserva` (`schema.prisma:25-31`) nem no model `Quarto` (`:193-215`).
3. **Fonte de verdade:** com check-out feito, `GET /api/checkouts/:reservaId` devolve `checkout != null` e
   `situacaoCheckout = "REALIZADO"`; a reserva aparece em `situacao=REALIZADOS`. Sem check-out, o mesmo
   `reserva.status` pode ser `FINALIZADA` (pago no MP) e **não** há `checkout`.
4. **Duplicidade:** dois `POST /api/checkouts` para a mesma reserva → `201` e depois `409`
   (`Check-out já realizado para esta reserva`), sem `500`.
5. **Elegibilidade:** reserva sem `CheckIn` → `400 A hospedagem ainda não realizou check-in — registre o
   check-in antes do check-out`; `CANCELADA` → `400`; `realizadoEm` futuro (> 5 min) → `400 A data e hora
   do check-out não pode estar no futuro`; anterior ao check-in → `400 …não pode ser anterior ao
   check-in`.
6. **Encerramento atômico:** exatamente 1 `CheckOut`, `Reserva.status = 'FINALIZADA'` e 1 `LogAuditoria`
   com `acao = 'CHECKOUT_REALIZADO'`; `SELECT status, valor FROM "Pagamento" WHERE reserva_id = …` igual
   ao estado anterior (nenhuma escrita financeira).
7. **Avisos (B-QA-1/B-QA-2):** reserva **sem check-in** devolve só os avisos financeiros — em dados reais,
   `HRND3T7ZNX` (`SOLICITADA`, sem check-in) retorna `[PAGAMENTO_PENDENTE, SALDO_EM_ABERTO]`; e
   `diasAposSaidaPrevista` de uma estadia já encerrada **não muda** de um dia para o outro (mesma base da
   auditoria).
8. **Regressão zero:** `cd backend; npm run build`; `GET /api/quartos/:id/availability` e
   `GET /api/reports/occupancy/:estabelecimentoId` respondem como antes da feature (mesmos filtros de
   status) — inclusive **bloqueando** datas de reserva com check-out antecipado (R-40: comportamento
   conhecido, não bug).
9. **Docs coerentes:** `docs/api/checkout.md` e `docs/flows/checkout.md` descrevem os mesmos códigos de
   erro/aviso do plano (`D-1..D-16`) e dos riscos R-40..R-46.
