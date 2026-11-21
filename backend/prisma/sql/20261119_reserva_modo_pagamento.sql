-- =============================================================================
-- 2026-11-19 — snapshot do modo de pagamento na reserva
-- =============================================================================
-- Contexto: a regra de negócio (Regra_Pagamento_Mercado_Pago.md) determina que
-- a troca do modo de pagamento de um estabelecimento vale apenas para reservas
-- novas; reservas em andamento seguem o modo em que foram criadas. Para isso o
-- modo precisa ser congelado em `Reserva`, e não lido ao vivo do estabelecimento.
--
-- Mudança: coluna nova, NÃO destrutiva, com default e backfill.
-- Rollback: ver o bloco comentado no fim do arquivo.
--
-- ATENÇÃO: este projeto não usa Prisma Migrate versionado (não há
-- prisma/migrations) e o banco Neon não está "baselined". Este arquivo é o
-- registro idempotente do SQL aplicado; para passar a usar migrations
-- versionadas é preciso um baseline (prisma migrate resolve / diff) aprovado
-- pelo responsável de dados.
-- -----------------------------------------------------------------------------

BEGIN;

ALTER TABLE "Reserva"
  ADD COLUMN IF NOT EXISTS "modo_pagamento" "ModoPagamentoEstabelecimento"
  NOT NULL DEFAULT 'PADRAO';

-- Backfill: reservas existentes herdam o modo atual do seu estabelecimento
-- (é a melhor aproximação possível do modo vigente quando foram criadas).
UPDATE "Reserva" r
   SET "modo_pagamento" = e."modo_pagamento"
  FROM "Estabelecimento" e
 WHERE r."estabelecimento_id" = e."id"
   AND r."modo_pagamento" <> e."modo_pagamento";

COMMIT;

-- Validação pós-migração -------------------------------------------------------
-- SELECT "modo_pagamento", COUNT(*) FROM "Reserva" GROUP BY 1;
-- SELECT COUNT(*) FROM "Reserva" WHERE "modo_pagamento" IS NULL; -- deve ser 0

-- Rollback ---------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE "Reserva" DROP COLUMN IF EXISTS "modo_pagamento";
-- COMMIT;
