-- =============================================================================
-- 2026-11-20 — check-out: encerramento da hospedagem
-- =============================================================================
-- Contexto: o estabelecimento precisa registrar o encerramento da hospedagem de
-- uma reserva — quando o check-out foi realizado, quem recebeu e observações —,
-- sem tocar em `StatusReserva` (mesma decisão do check-in: não impactar
-- pagamentos/ocupação/relatórios) e sem criar enum novo. Modelo espelhado em
-- `CheckIn` (backend/prisma/sql/20261120_checkin.sql), agora 1:1 com `Reserva`.
--
-- Mudança: 1 tabela nova (`CheckOut`), 1 FK 1:1 com `Reserva` (ON DELETE
-- CASCADE), 1 FK opcional com `Usuario` (ON DELETE SET NULL) e 2 índices
-- (`reserva_id` único — o par 1:1 — e `realizado_em` para listagem por data).
-- Puramente ADITIVO e NÃO destrutivo: nenhum ALTER/DROP em coluna existente,
-- nenhum backfill (tabela nova, nasce vazia) e nenhuma alteração em
-- `StatusReserva` ou em `Quarto`.
--
-- DDL derivado à mão de backend/prisma/schema.prisma (model `CheckOut`).
-- Nomes de tabela/índice/FK são os que o Prisma 6 emite.
--
-- Nota: o projeto não usa Prisma Migrate versionado (não há prisma/migrations);
-- este arquivo é o registro idempotente do SQL para aplicação manual no Neon.
-- Pré-requisitos: extensão "uuid-ossp" (já declarada no datasource do schema).
-- -----------------------------------------------------------------------------

BEGIN;

-- 1) CheckOut — 1:1 com Reserva (registro de encerramento da hospedagem) -------
CREATE TABLE IF NOT EXISTS "CheckOut" (
  "id"             uuid          NOT NULL DEFAULT uuid_generate_v4(),
  "reserva_id"     uuid          NOT NULL,
  "realizado_em"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responsavel_id" uuid,
  "observacoes"    text,
  "criado_em"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"  TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "CheckOut_pkey" PRIMARY KEY ("id")
);

-- 2) Índices -------------------------------------------------------------------
-- 1 check-out por reserva (@unique)
CREATE UNIQUE INDEX IF NOT EXISTS "CheckOut_reserva_id_key"
  ON "CheckOut"("reserva_id");

-- busca de check-outs por data de realização
CREATE INDEX IF NOT EXISTS "CheckOut_realizado_em_idx"
  ON "CheckOut"("realizado_em");

-- 3) FKs (nomes que o Prisma 6 usa por padrão) --------------------------------
DO $$
BEGIN
  ALTER TABLE "CheckOut"
    ADD CONSTRAINT "CheckOut_reserva_id_fkey"
    FOREIGN KEY ("reserva_id") REFERENCES "Reserva"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CheckOut"
    ADD CONSTRAINT "CheckOut_responsavel_id_fkey"
    FOREIGN KEY ("responsavel_id") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- Observações de aplicação -----------------------------------------------------
-- * TIMESTAMPTZ(6) é o que o Prisma 6 emite para @db.Timestamptz(); equivale a
--   "timestamptz" no PostgreSQL (precisão padrão 6).
-- * "atualizado_em" é NOT NULL SEM default, igual a "CheckIn": quem escreve pelo
--   Prisma sempre envia o valor (@updatedAt); INSERT via SQL cru precisa
--   preencher a coluna explicitamente.
-- * Nada foi aplicado no banco remoto durante a elaboração deste artefato; a
--   aplicação é o passo seguinte do dono da persistência.
-- * Com "Reserva" em volume relevante, o índice em "CheckOut" ainda é barato
--   (tabela nova, vazia) — CONCURRENTLY fica registrado só como referência:
--     CREATE INDEX CONCURRENTLY IF NOT EXISTS
--       "CheckOut_realizado_em_idx" ON "CheckOut"("realizado_em");
--   (CONCURRENTLY não roda dentro de BEGIN/COMMIT).

-- Validação pós-migração -------------------------------------------------------
-- SELECT to_regclass('"CheckOut"');                                          -- não nulo
-- SELECT conname FROM pg_constraint
--  WHERE conname IN ('CheckOut_reserva_id_fkey',
--                    'CheckOut_responsavel_id_fkey');                       -- 2 linhas
-- SELECT indexname FROM pg_indexes
--  WHERE indexname IN ('CheckOut_reserva_id_key',
--                      'CheckOut_realizado_em_idx');                        -- 2 linhas
-- SELECT column_name, is_nullable, column_default
--   FROM information_schema.columns WHERE table_name = 'CheckOut';           -- 7 colunas
-- -- 1:1 garantido por índice único, não por linha duplicada:
-- SELECT count(*) FROM "CheckOut" GROUP BY "reserva_id" HAVING count(*) > 1;  -- 0 linhas

-- Rollback ---------------------------------------------------------------------
-- BEGIN;
-- DROP TABLE IF EXISTS "CheckOut";   -- leva junto os 2 índices e as 2 FKs
-- COMMIT;
-- (nada a reverter em "Reserva"/"Usuario": as relações são virtuais no Prisma)
