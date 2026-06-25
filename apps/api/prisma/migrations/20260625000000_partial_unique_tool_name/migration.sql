-- Drop the old full-table unique constraint (blocks re-adding soft-deleted tools)
DROP INDEX IF EXISTS "tools_orgId_name_key";

-- Partial unique index: only enforce uniqueness on non-deleted rows
CREATE UNIQUE INDEX "tools_orgId_name_active_key"
  ON "tools"("orgId", "name")
  WHERE "deletedAt" IS NULL;
