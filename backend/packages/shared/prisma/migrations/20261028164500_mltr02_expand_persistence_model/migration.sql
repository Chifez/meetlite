-- MLTR-02: Expand the Persistence Model
-- Invariant: Series templates and joinable occurrences are distinguishable in storage.

-- 1. Create MeetingSeriesStatus Enum
CREATE TYPE "MeetingSeriesStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'ENDED');

-- 2. Create MeetingSeries Table
CREATE TABLE "meeting_series" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "series_id" TEXT NOT NULL,
    "organization_id" UUID,
    "team_id" UUID,
    "created_by" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "privacy" TEXT NOT NULL,
    "time_zone" TEXT NOT NULL,
    "local_start_date" TEXT NOT NULL,
    "local_start_time" TEXT NOT NULL,
    "recurrence_rule" TEXT NOT NULL,
    "status" "MeetingSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "materialized_through" TIMESTAMPTZ(3),
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meeting_series_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_meeting_series_local_start_date" CHECK ("local_start_date" ~ '^\d{4}-\d{2}-\d{2}$'),
    CONSTRAINT "check_meeting_series_local_start_time" CHECK ("local_start_time" ~ '^\d{2}:\d{2}(:\d{2})?$'),
    CONSTRAINT "check_meeting_series_duration_positive" CHECK ("duration_minutes" > 0),
    CONSTRAINT "check_meeting_series_revision_positive" CHECK ("revision" >= 1)
);

-- 3. Create Outbox Events Table
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" TEXT,
    "claim_expires_at" TIMESTAMPTZ(3),
    "claimed_by" TEXT,
    "dead_lettered_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meeting_series_attendees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "series_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_series_attendees_pkey" PRIMARY KEY ("id")
);

-- 4. Expand MeetingRecurrenceException without removing the legacy shape.
-- The legacy columns and FK remain readable/writable during the compatibility window.
ALTER TABLE "meeting_recurrence_exceptions"
    ADD COLUMN "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "kind" TEXT,
    ADD COLUMN "occurrence_key" TEXT,
    ADD COLUMN "override_meeting_id" UUID,
    ADD COLUMN "series_id" UUID,
    ADD COLUMN "series_revision" INTEGER;

-- 5. Alter Meetings Table to add Occurrence & Series Fields
ALTER TABLE "meetings"
    ADD COLUMN "duration_minutes" INTEGER,
    ADD COLUMN "event_time_zone" TEXT,
    ADD COLUMN "idempotency_key" TEXT,
    ADD COLUMN "lifecycle_revision" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "occurrence_key" TEXT,
    ADD COLUMN "scheduled_at" TIMESTAMPTZ(3),
    ADD COLUMN "series_id" UUID,
    ADD CONSTRAINT "check_meeting_lifecycle_revision_positive" CHECK ("lifecycle_revision" >= 1),
    ADD CONSTRAINT "check_meeting_duration_minutes_positive" CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0),
    ADD CONSTRAINT "check_meeting_series_occurrence_key" CHECK ("series_id" IS NULL OR "occurrence_key" IS NOT NULL);

-- 6. Staged Backfill: Initialize scheduled_at from scheduled_time assuming UTC
UPDATE "meetings"
SET "scheduled_at" = "scheduled_time" AT TIME ZONE 'UTC'
WHERE "scheduled_at" IS NULL;

-- 7. Create Indexes
CREATE UNIQUE INDEX "meeting_series_series_id_key" ON "meeting_series"("series_id");
CREATE UNIQUE INDEX "meeting_series_created_by_idempotency_key_key" ON "meeting_series"("created_by", "idempotency_key");
CREATE UNIQUE INDEX "meeting_series_attendees_series_id_email_key" ON "meeting_series_attendees"("series_id", "email");
CREATE INDEX "meeting_series_organization_id_status_idx" ON "meeting_series"("organization_id", "status");
CREATE INDEX "meeting_series_team_id_status_idx" ON "meeting_series"("team_id", "status");

CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");
CREATE INDEX "outbox_events_published_at_occurred_at_idx" ON "outbox_events"("published_at", "occurred_at");

CREATE UNIQUE INDEX "meeting_recurrence_exceptions_series_id_occurrence_key_key" ON "meeting_recurrence_exceptions"("series_id", "occurrence_key");

CREATE INDEX "meetings_organization_id_scheduled_at_idx" ON "meetings"("organization_id", "scheduled_at");
CREATE INDEX "meetings_series_id_scheduled_at_idx" ON "meetings"("series_id", "scheduled_at");
CREATE UNIQUE INDEX "meetings_series_id_occurrence_key_key" ON "meetings"("series_id", "occurrence_key");
CREATE UNIQUE INDEX "meetings_created_by_idempotency_key_key" ON "meetings"("created_by", "idempotency_key");

-- 8. Add Foreign Keys
ALTER TABLE "meeting_series" ADD CONSTRAINT "meeting_series_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meeting_series" ADD CONSTRAINT "meeting_series_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_series" ADD CONSTRAINT "meeting_series_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_series_attendees" ADD CONSTRAINT "meeting_series_attendees_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "meeting_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meetings" ADD CONSTRAINT "meetings_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "meeting_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meeting_recurrence_exceptions" ADD CONSTRAINT "meeting_recurrence_exceptions_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "meeting_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
