CREATE TABLE "tool_integrations" (
  "id"                TEXT NOT NULL,
  "toolId"            TEXT NOT NULL,
  "provider"          TEXT NOT NULL,
  "config"            JSONB NOT NULL DEFAULT '{}',
  "syncEveryMinutes"  INTEGER NOT NULL DEFAULT 15,
  "lastSyncAt"        TIMESTAMP(3),
  "lastSyncAmountINR" DOUBLE PRECISION,
  "lastError"         TEXT,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "tool_integrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tool_integrations_toolId_key" UNIQUE ("toolId"),
  CONSTRAINT "tool_integrations_toolId_fkey"
    FOREIGN KEY ("toolId") REFERENCES "tools"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
