-- =============================================================================
-- 2026-11-20 — fotos de evento (capa + galeria)
-- =============================================================================
-- Contexto: o cadastro de eventos precisa de uma foto de capa (exibida nos
-- cards e na agenda) e de fotos adicionais para o público visualizar. Em vez de
-- criar uma tabela paralela, a tabela genérica `Foto` (já usada por
-- estabelecimento e quarto) passa a aceitar `evento_id`; a capa continua sendo
-- o flag `is_capa`, com no máximo uma capa por dono (regra aplicada no service).
--
-- Mudança: coluna nova nullable + FK + índice. NÃO destrutiva, sem backfill.
-- Rollback: ver bloco comentado no fim do arquivo.
--
-- Nota: o projeto não usa Prisma Migrate versionado (não há prisma/migrations);
-- este arquivo é o registro idempotente do SQL aplicado no banco Neon.
-- -----------------------------------------------------------------------------

BEGIN;

ALTER TABLE "Foto"
  ADD COLUMN IF NOT EXISTS "evento_id" uuid;

DO $$
BEGIN
  ALTER TABLE "Foto"
    ADD CONSTRAINT "foto_evento_fk"
    FOREIGN KEY ("evento_id") REFERENCES "Evento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Foto_evento_id_idx" ON "Foto"("evento_id");

COMMIT;

-- Validação pós-migração -------------------------------------------------------
-- SELECT COUNT(*) FROM "Foto" WHERE "evento_id" IS NOT NULL; -- 0 logo após aplicar
-- SELECT evento_id, COUNT(*) FILTER (WHERE is_capa) AS capas
--   FROM "Foto" WHERE evento_id IS NOT NULL GROUP BY 1;     -- capas <= 1 por evento

-- Rollback ---------------------------------------------------------------------
-- BEGIN;
-- DROP INDEX IF EXISTS "Foto_evento_id_idx";
-- ALTER TABLE "Foto" DROP CONSTRAINT IF EXISTS "foto_evento_fk";
-- ALTER TABLE "Foto" DROP COLUMN IF EXISTS "evento_id";
-- COMMIT;
