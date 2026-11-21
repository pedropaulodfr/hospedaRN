# ADRs — decisões arquiteturais do HospedaRN

Registro curto de decisões que são caras de reverter. Um arquivo por decisão:
`ADR-<nnn>-<slug>.md` (numeração sequencial, sem reaproveitar número).

Use ADR para: mudança de modelo de dados, mudança de fluxo de pagamento/reserva, troca de biblioteca
estrutural, mudança de contrato de API público, decisão de arquitetura de agentes. Para mudança
rotineira, `ImplementationPlan` basta.

## Template

```markdown
# ADR-000 — <título da decisão>

- **Data:** AAAA-MM-DD
- **Status:** proposta | aceita | substituída por ADR-00X
- **Decisores:** usuário / hospedarn-arquiteto (+ skill consultada)

## Contexto
<o problema, com evidência (arquivo:linha, risco R-xx, requisito do documento)>

## Decisão
<o que foi decidido, em 1 parágrafo, no presente do indicativo>

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|

## Consequências
- **Positivas:**
- **Negativas / custo:**
- **Impacto em:** banco, API, frontend, pagamento, testes

## Como validar
<comando, teste ou cenário que prova que a decisão está implementada>
```

## Índice

| ADR | Título | Status | Plano / contexto |
|---|---|---|---|
| [ADR-001](ADR-001-checkin-entidade-aditiva.md) | Check-in como entidade aditiva, sem novo valor em `StatusReserva` | aceita (2026-11-20) | [Plano](../../Implementations/ImplementationPlan_CheckinEstabelecimento_20112026.md) · [API check-in](../api/checkin.md) · [Fluxo](../flows/checkin.md) |
| [ADR-002](ADR-002-checkout-encerramento-hospedagem.md) | Check-out como entidade aditiva e `FINALIZADA` como consequência do encerramento | aceita (2026-11-20) | [Plano](../../Implementations/ImplementationPlan_CheckoutEstabelecimento_20112026.md) · [API check-out](../api/checkout.md) · [Fluxo](../flows/checkout.md) |

> **Convenção de numeração:** sequencial a partir de `001`, um arquivo por decisão. O primeiro ADR
> do projeto é o `001` (o índice estava vazio antes dele) — não pule números.
