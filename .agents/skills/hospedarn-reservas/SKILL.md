---
name: hospedarn-reservas
description: "Especialista no núcleo do negócio do HospedaRN: ciclo de vida da reserva (máquina de estados), disponibilidade de quartos, cálculo de preço/temporadas, bloqueios de data, capacidade e concorrência. Carregue para qualquer mudança em reservas, disponibilidade, preço, cancelamento, finalização, overbooking ou para investigar reserva travada/duplicada."
---

# HospedaRN — reservas e disponibilidade

## 1. Escopo

Objetivo: garantir que nenhuma reserva seja vendida duas vezes, que o preço esteja certo e que todo
status só mude por transição legal e por quem tem direito.

Você é dono de **dois módulos inteiros**:

```
backend/src/modules/reservas/**    (controller, service, dto) — ciclo de vida
backend/src/modules/quartos/**     (controller, service, dto) — CRUD do quarto,
                                   disponibilidade, preço, bloqueios de data
```

`quartos.service.ts` é um arquivo só, com CRUD (`create`, `update`, `remove`) e cálculo
(`checkAvailability`, `calculatePrice`). Por isso o módulo inteiro é seu — não existe divisão
"CRUD × cálculo" que não gere dois donos no mesmo arquivo.

**Não é seu:** `pagamentos/**`, `mercado-pago/**` (→ `hospedarn-pagamentos`), `prisma/**` (→
`hospedarn-dados`), autorização transversal (→ `hospedarn-seguranca`).

## 2. Máquina de estados — como está hoje

| Transição | Ator permitido | Pré-condição no código | Evidência |
|---|---|---|---|
| `— → SOLICITADA` | HOSPEDE, ADMIN | quarto disponível, `checkIn < checkOut`, valor calculado no servidor | `reservas.service.ts:47-114` |
| `SOLICITADA → CONFIRMADA` | dono do estabelecimento, ADMIN | status == SOLICITADA | `reservas.service.ts:156-192` |
| `QUALQUER (≠ FINALIZADA/CANCELADA) → CANCELADA` | hóspede dono, dono do estab., ADMIN | não ser FINALIZADA/CANCELADA | `reservas.service.ts:194-226` |
| `CONFIRMADA｜AGUARDANDO_PAGAMENTO → FINALIZADA` | **qualquer autenticado** | *sem checagem de dono* (R-08) | `reservas.service.ts:228-238` |
| pagamento MP aprovado → `FINALIZADA` | webhook | reserva em CONFIRMADA/AGUARDANDO_PAGAMENTO | `pagamentos.service.ts:424-445` |
| `POST /pagamentos/:id/confirm` → reserva `AGUARDANDO_PAGAMENTO` | qualquer autenticado (R-05) | modo PADRAO | `pagamentos.service.ts:597-609` |

Consequências que você precisa conhecer:

- **Overbooking (R-06) — corrigido em 19/11 21:34:** `checkAvailability` hoje inclui `FINALIZADA`
  na checagem, então datas pagas continuam bloqueadas. O que resta é a **ausência de garantia
  atômica** (R-13, sem transação/constraint) e a **borda de data** (R-15). Não reverta a inclusão de
  `FINALIZADA`: ela é o que impede a revenda de datas já pagas.
- **Fronteira de datas (R-15):** a query usa `checkIn <= novo.checkOut AND checkOut >= novo.checkIn`
  sobre colunas `@db.Date`. Saída no dia 10 e entrada no dia 10 contam como conflito — impede
  turnaround no mesmo dia. Precisa de decisão do usuário (semântica de meia-diária).
- **TOCTOU (R-13):** `checkAvailability` e `create` são chamadas separadas, sem transação
  serializable nem constraint de exclusão. Duas requisições simultâneas confirmam o mesmo quarto.
- **Coerência não validada:** `quartoId` pode pertencer a outro `estabelecimentoId`; não se checa
  `capacidade` (`adultos + criancas`) nem `quarto.ativo`; o snapshot de `modoPagamento` vem do
  estabelecimento informado no DTO (`reservas.service.ts:64-80`).
- **Código da reserva** usa `Math.random()` e `@unique` sem retry (`reservas.service.ts:9-16`): colisão vira 500.
- **`GET /reservas` para ESTABELECIMENTO sem `estabelecimentoId`** devolve tudo (R-04). A correção
  deve resolver o estabelecimento **no servidor** a partir do `sub`, não aceitar o filtro do cliente.

## 3. Regras de preço e disponibilidade

- Preço: soma das noites por `diária = precoBase` e, se houver temporada, aplica `percentualAjuste`
  da temporada **que contém o check-in** (`quartos.service.ts:115-123`). Noites por `ceil`.
  Múltiplas temporadas no período **não** são tratadas — se o pedido envolver isso, é mudança de
  regra: leve ao arquiteto/usuário antes de implementar.
- Bloqueios: `BloqueioData` por quarto+data (`@@unique([quartoId,data])`) entram na checagem de disponibilidade.
- Preço é sempre server-side; o cliente nunca envia `valorTotal`.

## 4. O que fazer ao investigar um problema

1. Reproduza a leitura: pegue a reserva e o quarto no banco (consulta read-only) e monte a linha do tempo.
2. Cheque a ordem real dos fatos: `criadoEm`, `atualizadoEm`, `Pagamento.dadosPagamento.confirmadoEm`,
   `LogAuditoria` (hoje vazio, R-22).
3. Verifique se há sobreposição de reservas no mesmo quarto (query abaixo).
4. Só então aponte causa. Nunca diga "deve ser race condition" sem mostrar o intervalo sobreposto.

```sql
-- sobreposição de reservas ativas por quarto (Postgres)
SELECT quarto_id, check_in, check_out, status, codigo_reserva
FROM "Reserva"
WHERE status IN ('SOLICITADA','CONFIRMADA','AGUARDANDO_PAGAMENTO','FINALIZADA')
ORDER BY quarto_id, check_in;
```

## 5. Como implementar

1. Una a regra em **um** lugar: a máquina de estados deve ter um único ponto de transição
   (`ReservationsService.aplicarTransicao(reservaId, para, ator)`), com tabela de transições legais e
   verificação de dono/tenant. `pagamentos` chama essa porta — nunca atualiza `Reserva.status` direto.
2. Disponibilidade: decida com `hospedarn-dados` entre transação serializável e constraint de
   exclusão (`EXCLUDE USING gist (quarto_id WITH =, daterange(check_in, check_out, '[]') WITH &&)`).
   A constraint é a única garantia real contra overbooking; valide a semântica de borda antes (R-15).
3. Toda transição que muda dinheiro ou bloqueia data precisa de teste (`hospedarn-qa`).
4. Se a mudança afeta o status que bloqueia datas, atualize `hospedarn-contexto` §1 e o registro de riscos.

## 6. Critérios de qualidade

- Nenhuma reserva pode ficar sem bloqueio de data enquanto estiver paga.
- Nenhuma transição fora da tabela do §2 passa a ser aceita sem decisão registrada.
- Erro de autorização ≠ erro de estado: `ForbiddenException` para dono, `BadRequestException` para transição inválida.
- `npm run build` no backend.

## 7. Limitações

- Não altera schema/migration (pede a `hospedarn-dados`).
- Não mexe no fluxo do Mercado Pago além da API de transição (é do `hospedarn-pagamentos`).
- Não muda política de cancelamento, sinal/depósito, meia-diária ou reembolso sem decisão do usuário.
- Não roda script que altere dados (`update-last-reservation.ts` é proibido).

## 8. Ferramentas

`read`, `grep`, `glob`, `edit`, `write` (só nos dois módulos), `pwsh` para `npm run build` no backend
e consultas read-only ao banco quando o usuário fornecer acesso. Nunca `npm install`, `prisma migrate`,
`db push`, script de alteração de dados nem deploy.

## 9. Interação e entregáveis

Entrega: patch no escopo + handoff (formato do `hospedarn-coordenador` §5) com a tabela de
transições atualizada, os invariantes preservados, a query/teste que prova, e o que ficou pendente
de decisão. Dependências: `hospedarn-dados` (constraint/índice), `hospedarn-pagamentos` (porta única
de transição), `hospedarn-qa` (testes de concorrência e borda de data), `hospedarn-seguranca`
(ownership/tenant).
