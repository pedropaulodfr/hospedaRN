# ADR-001 — Check-in como entidade aditiva, sem novo valor em `StatusReserva`

- **Data:** 2026-11-20
- **Status:** aceita
- **Decisores:** usuário/lead (`hospedarn-coordenador`) fixou a decisão; `hospedarn-arquiteto` registra, valida no código e detalha as consequências
- **Numeração:** `001` porque o índice de `docs/adr/README.md` não tinha nenhum ADR registrado antes deste (a convenção proíbe reaproveitar número; criar `002` deixaria um buraco sem `001`)
- **Plano relacionado:** `Implementations/ImplementationPlan_CheckinEstabelecimento_20112026.md`
- **Contrato:** `docs/api/checkin.md` · **Fluxo:** `docs/flows/checkin.md`

## Contexto

O módulo do Estabelecimento precisa registrar a **realização da estadia** (check-in): quem chegou,
quem são os acompanhantes, quando e por quem o check-in foi feito, com trilha de auditoria. Hoje o
projeto não tem nada disso (busca por `CheckIn`/`acompanhante` em `backend/src/**` só encontra a
mensagem de validação de datas em `backend/src/modules/reservas/reservas.service.ts:52`).

O caminho "óbvio" seria adicionar um valor ao enum `StatusReserva` (por exemplo `EM_ESTADIA`). Esse
caminho está **bloqueado por fatos do código**, não por preferência:

1. `StatusReserva` tem exatamente 5 valores comerciais (`backend/prisma/schema.prisma:25-31`):
   `SOLICITADA`, `CONFIRMADA`, `AGUARDANDO_PAGAMENTO`, `FINALIZADA`, `CANCELADA`.
2. `FINALIZADA` **não significa "estadia encerrada"**: é setado por três caminhos diferentes —
   (a) pagamento aprovado no Mercado Pago (`backend/src/modules/pagamentos/pagamentos.service.ts:628-654`);
   (b) `PATCH /reservas/:id/finalize` manual (`backend/src/modules/reservas/reservas.service.ts:228-238`);
   (c) em nenhum caso depende de a data de saída ter chegado. O próprio `confirm` manual leva a
   reserva para `AGUARDANDO_PAGAMENTO` (`pagamentos.service.ts:813-825`).
   A especificação do produto, por outro lado, descreve `FINALIZADA` como "concluída (após data de
   saída)" (`Documento_Especificacao_Requisitos.md:124`) — **divergência já registrada e não resolvida
   por este ADR**.
3. Os consumidores do enum dependem dele como máquina **comercial**:
   - ocupação/receita do relatório: `status in ['CONFIRMADA','FINALIZADA']`
     (`backend/src/modules/reports/reports.service.ts:14` e `:57`);
   - disponibilidade/anti-overbooking: bloqueia `SOLICITADA`, `CONFIRMADA`, `AGUARDANDO_PAGAMENTO`,
     `FINALIZADA` (`backend/src/modules/quartos/quartos.service.ts:73-101`, lista em `:80-82`).
4. Um valor novo no enum obriga a revisar **todos** esses predicados (senão a nova reserva "em
   estadia" deixa de bloquear data — overbooking — ou sai da receita). Além disso, `StatusReserva`
   é um único estado linear; check-in **coexiste** com pagamento pendente, com finalização e com
   cancelamento posterior — não é um estado da mesma máquina.
5. Não existe histórico de migrations (`backend/prisma/migrations` não existe; o padrão real é
   schema-first com `prisma db push` — `backend/package.json:15`). Portanto "só mais um valor de enum"
   também não pouparia esforço de banco: qualquer mudança passa pelo mesmo caminho.

## Decisão

A realização da estadia é registrada em **entidades aditivas**: `CheckIn` (1:1 com `Reserva`, via
`reservaId @unique`, com `realizadoEm`, `responsavelId` e `observacoes`) e `HospedeCheckIn` (hóspede
principal e acompanhantes: `principal`, `nome`, `cpf`, `documento`, `dataNascimento`, `telefone`,
`parentesco`, `presente`, `observacoes`). `StatusReserva` **não muda** e o quarto não recebe campo de
situação. A situação da hospedagem (`PENDENTE` | `ATRASADO` | `REALIZADO`) é **derivada** do `CheckIn`
na resposta da API, nunca persistida. A elegibilidade para check-in é uma regra de serviço
(`CONFIRMADA` | `AGUARDANDO_PAGAMENTO` | `FINALIZADA`, hoje ≤ `checkOut`, sem check-in prévio), não um
estado do enum.

A implementação (20/11/2026) fica em `backend/src/modules/reservas/checkins/**` — dentro do domínio
de reservas, não em um `modules/checkins` novo — e acrescentou três decisões que o desenho inicial
não previa:

- **D-6 — texto × código de inelegibilidade.** A API devolve `motivoInelegibilidade` como **texto
  pt-BR** (a UI exibe direto) e `codigoInelegibilidade` como identificador estável
  (`RESERVA_CANCELADA`, `STATUS_INVALIDO`, `CHECKIN_JA_REALIZADO`, `PERIODO_ENCERRADO`). O desenho
  inicial previa só o código; na prática a UI precisa da frase pronta e a máquina precisa do código,
  então são dois campos (`checkins.service.ts:117-123,624-662`).
- **D-7 — janela operacional da central.** O recorte default e o de `ATRASADOS` exigem estadia vigente
  (`checkOut ≥ hoje`); `TODOS` = `OR[{status permitido, checkOut ≥ hoje}, {tem check-in}]`. Histórico
  encerrado sem check-in (no-show antigo) **não** aparece na central, mas continua acessível por URL
  direta no detalhe (`checkins.service.ts:501-531`). Sem isso, reservas vencidas de junho/2026
  apareciam como "atrasadas" (9 itens de ruído medidos em dados reais).
- **D-8 — guarda de cancelamento pós-check-in.** `ReservationsService.cancel` passou a bloquear com
  `400` qualquer reserva que já tenha `CheckIn` (`reservas.service.ts:211-221`), fechando a pendência
  P-2 do plano e evitando `CheckIn` órfão de reserva cancelada.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Novo valor em `StatusReserva` (ex.: `CHECK_IN`/`EM_ESTADIA`) | Reescreve a máquina comercial usada por relatórios (`reports.service.ts:14,57`), disponibilidade (`quartos.service.ts:80-82`), pagamento (`pagamentos.service.ts:127`) e frontend. Precisa decidir se "em estadia" bloqueia data, se entra na receita, o que acontece com `FINALIZADA` depois do check-in, e o que um check-in + pagamento pendente significa. Estado linear único para dois eixos independentes (comercial × operacional). |
| Reutilizar `FINALIZADA` como "estadia concluída" (sem entidade nova) | Perde o eixo temporal (não se sabe quando o hóspede chegou), não guarda acompanhantes nem responsável, e colide com os dois usos atuais de `FINALIZADA` (pago no MP × finalizado manual). |
| Flag booleana em `Reserva` (`checkInRealizado Boolean`) | Não guarda `realizadoEm`, `responsavelId`, `observacoes` nem acompanhantes; viraria 4–5 colunas nulas em `Reserva` + tabela de acompanhantes — pior modelagem que a entidade 1:1. |
| Tabela de "estadia" desacoplada da reserva (`Estadia` com FK opcional) | Permite estadia sem reserva, o que não existe no produto; multiplica os caminhos de integridade (reserva cancelada sem estadia, duas estadias). O 1:1 com `@unique` já é a restrição desejada. |
| **Entidades aditivas `CheckIn` + `HospedeCheckIn` (escolhida)** | Uma responsabilidade por entidade; check-in é evento com carimbo de tempo e responsável; acompanhantes são lista; enum comercial intocado → nenhum consumidor existente muda; duplicidade garantida por constraint. |

## Consequências

- **Positivas:**
  - Zero regressão em relatórios, disponibilidade/preço, pagamento e frontend do hóspede: `StatusReserva` e seus predicados seguem idênticos.
  - Dois eixos independentes (comercial × operacional) modelados separadamente: pagamento pendente e finalização **coexistem** com o check-in sem combinatória de estados; o cancelamento posterior passou a ser bloqueado por regra (D-8), não por estar "no enum".
  - Duplicidade de check-in vira invariante de banco (`CheckIn.reservaId @unique`), não só checagem de aplicação — fecha a corrida de duplo `POST`.
  - Histórico fiel: `realizadoEm` (quando), `responsavelId` (quem), `HospedeCheckIn.presente` (quem de fato se apresentou) + `LogAuditoria` com `acao='CHECKIN_REALIZADO'`.
  - Base natural para o check-out futuro (a entidade cresce; o enum não precisa crescer).
  - Cancelamento deixou de poder "engolir" um check-in: reserva com estadia registrada responde `400` (D-8), então o par reserva × check-in não fica inconsistente.
  - UI e máquina atendidas sem dicionário no cliente: texto pt-BR + código estável (D-6).
- **Negativas / custo:**
  - A situação da hospedagem é **calculada** em toda leitura (algumas comparações de data + existência de `CheckIn`); não é filtrável por índice como um enum. Mitigado pelo índice `(estabelecimentoId, checkIn, status)` (`backend/prisma/schema.prisma:287`) e por `CheckIn.realizadoEm` indexado (`:372`).
  - Quem consumir `StatusReserva` não "vê" o check-in: é preciso usar os novos endpoints. Relatório de ocupação **continua comercial** (`reports.service.ts`) até uma decisão de produto separada.
  - Duas fontes de verdade adjacentes (`Reserva.status` + `CheckIn`): exige disciplina para não duplicar regra (`elegivel` é só do serviço de check-in).
  - O recorte operacional (D-7) é uma decisão de produto embutida na consulta: no-show antigo some da central (só o detalhe mostra). Mudar a janela é mudança de comportamento, não de infraestrutura.
  - A guarda de cancelamento (D-8) é uma **checagem de aplicação fora de transação**: entre ler o `CheckIn` e gravar `CANCELADA` há janela para corrida com o `POST /checkins` (ver R-36 no registro de riscos). A unique de `CheckIn.reservaId` protege a duplicidade, não essa corrida.
- **Impacto em:**
  - **banco:** 2 tabelas novas + 2 índices + 1 unique + 1 índice em `Reserva` (nenhuma coluna existente alterada, sem backfill). DDL **aplicada** no Neon via `prisma db execute` com `backend/prisma/sql/20261120_checkin.sql` (idempotente; 23 reservas preservadas) + `prisma generate` — não há `prisma/migrations`; mesma convenção de `20261119_reserva_modo_pagamento.sql` e `20261120_evento_fotos.sql`. Rollback: `DROP TABLE "HospedeCheckIn"; DROP TABLE "CheckIn";`.
  - **API:** 3 rotas novas (`GET /checkins`, `GET /checkins/:reservaId`, `POST /checkins`); contrato real da lista é nested (`{ reserva, checkin, situacaoCheckIn, elegivel, motivoInelegibilidade, codigoInelegibilidade, checkInAntecipado, diasParaChegada }`) e o detalhe expõe `reserva.hospede.hospedePerfil`. Nenhuma rota existente muda de contrato, mas `PATCH /reservas/:id/cancel` mudou de **comportamento** (D-8).
  - **backend:** implementação em `backend/src/modules/reservas/checkins/` + registro em `reservas.module.ts:4-5,13-14`; `app.module.ts`/`main.ts` intocados (tag Swagger vem de `@ApiTags('Check-in')`).
  - **frontend:** central nova no módulo do Estabelecimento (`EstCheckin.tsx`, rota `/estabelecimento/checkin`, menu) + `checkinsApi`; nenhuma tela existente precisa mudar de contrato.
  - **pagamento:** nenhuma mudança. Check-in com pagamento pendente é permitido e apenas sinalizado.
  - **testes:** a matriz de regras (status × período × check-in existente) substitui a matriz de enum; exige testes de autorização/posse e de concorrência (`P2002`).

## Como validar

Execução de 20/11/2026 (lead/QA): **`npm run build` OK**; **`npm test` 6 suites / 121 testes PASS**
(90 novos); **cobertura 99,5%** do `CheckinsService`; **E2E HTTP real 29/30** (o único FAIL foi bug de
regex do script de teste, não do produto); **DDL aplicada** no Neon via `prisma db execute` com 23
reservas preservadas. Reprodução:

1. **Estado do banco:** `SELECT to_regclass('"CheckIn"'), to_regclass('"HospedeCheckIn"');` não nulos;
   `SELECT count(*) FROM "CheckIn";` = 0 antes do uso; após o fluxo, exatamente 1 linha por reserva:
   `SELECT "reserva_id", count(*) FROM "CheckIn" GROUP BY 1 HAVING count(*) > 1;` → 0 linhas.
2. **Enum intocado:** `git diff backend/prisma/schema.prisma` não mostra alteração em `enum StatusReserva`
   (`schema.prisma:25-31`); `GET /api/reservas` continua devolvendo os 5 valores de sempre.
3. **Duplicidade:** dois `POST /api/checkins` para a mesma reserva → `201` e depois `409`
   (`Check-in já realizado para esta reserva`), sem `500` — coberto por `checkins.service.spec.ts`
   e por `checkins.controller.spec.ts`.
4. **Coexistência de eixos:** reserva `AGUARDANDO_PAGAMENTO` com check-in feito → `GET /api/checkins`
   mostra `situacaoCheckIn = "REALIZADO"`, `reserva.status = "AGUARDANDO_PAGAMENTO"`, item inelegível
   com `codigoInelegibilidade = "CHECKIN_JA_REALIZADO"`; o pagamento pode ser confirmado depois sem
   tocar no `CheckIn`.
5. **Guarda de cancelamento (D-8):** `PATCH /api/reservas/:id/cancel` em reserva já checkada → `400`
   `Reserva com check-in já realizado não pode ser cancelada` — coberto por
   `reservas-cancelamento.spec.ts`.
6. **Recorte operacional (D-7):** reserva com `checkOut < hoje` e sem check-in **não** aparece em
   `GET /api/checkins?situacao=TODOS` nem em `ATRASADOS`; o detalhe por URL direta continua
   respondendo e o `POST` devolve `400` `O período da estadia desta reserva já foi encerrado`.
7. **Regressão zero:** `cd backend; npm run build`;
   `GET /api/reports/occupancy/:estabelecimentoId?month=11&year=2026`
   (`backend/src/modules/reports/reports.controller.ts:15`) e `GET /api/quartos/:id/availability`
   respondem como antes da feature (mesmos filtros de status). Riscos residuais conhecidos:
   R-36 (corrida cancelamento × check-in), R-37 (`Hospede.cpf` sem unique), R-38 (403 × 404) e
   R-39 (card × aba de realizados) em `docs/agents/RISCOS-VERIFICADOS.md`.
