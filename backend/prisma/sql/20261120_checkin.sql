-- =============================================================================
-- 2026-11-20 — check-in: realização da estadia + hóspedes presentes
-- =============================================================================
-- Contexto: o estabelecimento precisa registrar a realização do check-in de uma
-- reserva (quem recebeu, quando, observações) e quem efetivamente se apresentou
-- — titular + acompanhantes —, sem tocar em `StatusReserva` (decisão do plano:
-- não impactar pagamentos/ocupação/relatórios) e sem criar enum novo.
--
-- Mudança: 2 tabelas novas, 1 FK 1:1 com `Reserva`, 1 FK opcional com `Usuario`,
-- índices e 1 índice em `Reserva` que serve a central de check-in
-- (`estabelecimento_id, check_in, status`). Esse índice é COMPLEMENTAR: ele não
-- fecha o R-14, cuja evidência pede `Reserva(quartoId, status, checkIn, checkOut)`
-- para a checagem de disponibilidade — o R-14 continua aberto.
-- Tudo NÃO destrutivo, sem backfill (tabelas novas; índice apenas acelera).
-- Rollback: ver bloco comentado no fim do arquivo.
--
-- DDL derivado à mão de backend/prisma/schema.prisma (models `CheckIn` e
-- `HospedeCheckIn`). Nomes de tabela/índice/FK são os que o Prisma 6 emite.
-- Rollback: ver bloco comentado no fim do arquivo.
--
-- Nota: o projeto não usa Prisma Migrate versionado (não há prisma/migrations);
-- este arquivo é o registro idempotente do SQL para aplicação manual no Neon.
-- Pré-requisitos: extensão "uuid-ossp" (já declarada no datasource do schema).
-- NÃO houve alteração no banco remoto durante a elaboração deste artefato.
-- -----------------------------------------------------------------------------

BEGIN;

-- 1) CheckIn — 1:1 com Reserva (registro imutável de realização) --------------
CREATE TABLE IF NOT EXISTS "CheckIn" (
  "id"             uuid          NOT NULL DEFAULT uuid_generate_v4(),
  "reserva_id"     uuid          NOT NULL,
  "realizado_em"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responsavel_id" uuid,
  "observacoes"    text,
  "criado_em"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"  TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- 2) HospedeCheckIn — hóspedes presentes no check-in + acompanhantes ----------
CREATE TABLE IF NOT EXISTS "HospedeCheckIn" (
  "id"              uuid          NOT NULL DEFAULT uuid_generate_v4(),
  "check_in_id"     uuid          NOT NULL,
  "principal"       boolean       NOT NULL DEFAULT false,
  "nome"            varchar(255)  NOT NULL,
  "cpf"             varchar(14),
  "documento"       varchar(40),
  "data_nascimento" date,
  "telefone"        varchar(20),
  "parentesco"      varchar(80),
  "presente"        boolean       NOT NULL DEFAULT true,
  "observacoes"     text,
  "criado_em"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HospedeCheckIn_pkey" PRIMARY KEY ("id")
);

-- 3) Índices -------------------------------------------------------------------
-- 1 check-in por reserva (@unique)
CREATE UNIQUE INDEX IF NOT EXISTS "CheckIn_reserva_id_key"
  ON "CheckIn"("reserva_id");

-- busca de check-ins por data de realização
CREATE INDEX IF NOT EXISTS "CheckIn_realizado_em_idx"
  ON "CheckIn"("realizado_em");

-- listagem dos hóspedes de um check-in
CREATE INDEX IF NOT EXISTS "HospedeCheckIn_check_in_id_idx"
  ON "HospedeCheckIn"("check_in_id");

-- R-14: central de check-in / agenda por estabelecimento, período e status
CREATE INDEX IF NOT EXISTS "Reserva_estabelecimento_id_check_in_status_idx"
  ON "Reserva"("estabelecimento_id", "check_in", "status");

-- 4) FKs (nomes que o Prisma 6 usa por padrão) --------------------------------
DO $$
BEGIN
  ALTER TABLE "CheckIn"
    ADD CONSTRAINT "CheckIn_reserva_id_fkey"
    FOREIGN KEY ("reserva_id") REFERENCES "Reserva"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CheckIn"
    ADD CONSTRAINT "CheckIn_responsavel_id_fkey"
    FOREIGN KEY ("responsavel_id") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "HospedeCheckIn"
    ADD CONSTRAINT "HospedeCheckIn_check_in_id_fkey"
    FOREIGN KEY ("check_in_id") REFERENCES "CheckIn"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- Observações de aplicação -----------------------------------------------------
-- * TIMESTAMPTZ(6) é o que o Prisma 6 emite para @db.Timestamptz(); equivale a
--   "timestamptz" no PostgreSQL (precisão padrão 6).
-- * Em "Reserva" com volume relevante, aplicar o índice fora de transação:
--     CREATE INDEX CONCURRENTLY IF NOT EXISTS
--       "Reserva_estabelecimento_id_check_in_status_idx"
--       ON "Reserva"("estabelecimento_id", "check_in", "status");
--   (CONCURRENTLY não roda dentro de BEGIN/COMMIT).

-- Validação pós-migração -------------------------------------------------------
-- SELECT to_regclass('"CheckIn"'), to_regclass('"HospedeCheckIn"');        -- não nulos
-- SELECT conname FROM pg_constraint
--  WHERE conname IN ('CheckIn_reserva_id_fkey',
--                    'CheckIn_responsavel_id_fkey',
--                    'HospedeCheckIn_check_in_id_fkey');                  -- 3 linhas
-- SELECT indexname FROM pg_indexes
--  WHERE indexname IN ('CheckIn_reserva_id_key',
--                      'CheckIn_realizado_em_idx',
--                      'HospedeCheckIn_check_in_id_idx',
--                      'Reserva_estabelecimento_id_check_in_status_idx');  -- 4 linhas

-- Rollback ---------------------------------------------------------------------
-- BEGIN;
-- DROP TABLE IF EXISTS "HospedeCheckIn";   -- cascateia FK para "CheckIn"
-- DROP TABLE IF EXISTS "CheckIn";          -- cascateia FKs para "Reserva"/"Usuario"
-- DROP INDEX IF EXISTS "Reserva_estabelecimento_id_check_in_status_idx";
-- COMMIT;
