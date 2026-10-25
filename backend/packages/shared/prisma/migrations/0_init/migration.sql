-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "google_id" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "use_name_in_meetings" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_use_case" TEXT,
    "onboarding_team_size" TEXT,
    "onboarding_experience" TEXT,
    "organization_id" UUID,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "plan_type" TEXT NOT NULL DEFAULT 'free',
    "plan_start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plan_end_date" TIMESTAMP(3),
    "plan_status" TEXT NOT NULL DEFAULT 'active',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "last_payment_date" TIMESTAMP(3),
    "is_system_admin" BOOLEAN NOT NULL DEFAULT false,
    "token_version" INTEGER NOT NULL DEFAULT 1,
    "reset_token" TEXT,
    "reset_token_expiry" TIMESTAMP(3),
    "notify_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notify_in_app" BOOLEAN NOT NULL DEFAULT true,
    "notify_email" BOOLEAN NOT NULL DEFAULT true,
    "notify_push" BOOLEAN NOT NULL DEFAULT false,
    "notify_meeting_reminders" BOOLEAN NOT NULL DEFAULT true,
    "notify_meeting_invitations" BOOLEAN NOT NULL DEFAULT true,
    "notify_recording_ready" BOOLEAN NOT NULL DEFAULT true,
    "plan_last_warning_sent" TIMESTAMP(3),
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_usage" (
    "user_id" UUID NOT NULL,
    "organizations_owned" INTEGER NOT NULL DEFAULT 0,
    "organizations_member" INTEGER NOT NULL DEFAULT 0,
    "invitations_sent_today" INTEGER NOT NULL DEFAULT 0,
    "invitations_sent_this_month" INTEGER NOT NULL DEFAULT 0,
    "last_invitation_date" TIMESTAMP(3),
    "last_monthly_reset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meetings_created_today" INTEGER NOT NULL DEFAULT 0,
    "meetings_created_this_month" INTEGER NOT NULL DEFAULT 0,
    "last_meeting_date" TIMESTAMP(3),
    "storage_used_gb" DECIMAL(10,3) NOT NULL DEFAULT 0.0,
    "api_calls_today" INTEGER NOT NULL DEFAULT 0,
    "last_api_call_date" TIMESTAMP(3),

    CONSTRAINT "user_usage_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "plan_type" TEXT NOT NULL DEFAULT 'free',
    "plan_start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plan_end_date" TIMESTAMP(3),
    "plan_status" TEXT NOT NULL DEFAULT 'active',
    "allow_public_meetings" BOOLEAN NOT NULL DEFAULT true,
    "require_meeting_approval" BOOLEAN NOT NULL DEFAULT false,
    "max_meeting_duration" INTEGER NOT NULL DEFAULT 480,
    "allow_external_participants" BOOLEAN NOT NULL DEFAULT true,
    "default_meeting_privacy" TEXT NOT NULL DEFAULT 'public',
    "billing_customer_id" TEXT,
    "billing_subscription_id" TEXT,
    "billing_status" TEXT,
    "billing_period_end" TIMESTAMP(3),
    "limit_max_members" INTEGER NOT NULL DEFAULT 10,
    "limit_max_meetings_month" INTEGER NOT NULL DEFAULT 100,
    "limit_max_storage_gb" INTEGER NOT NULL DEFAULT 1,
    "stats_total_members" INTEGER NOT NULL DEFAULT 0,
    "stats_total_meetings" INTEGER NOT NULL DEFAULT 0,
    "stats_total_hours" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "owner_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_organization_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "invited_by" UUID,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "owner_id" UUID NOT NULL,
    "allow_public_meetings" BOOLEAN NOT NULL DEFAULT true,
    "require_meeting_approval" BOOLEAN NOT NULL DEFAULT false,
    "max_meeting_duration" INTEGER NOT NULL DEFAULT 480,
    "allow_external_participants" BOOLEAN NOT NULL DEFAULT true,
    "default_meeting_privacy" TEXT NOT NULL DEFAULT 'public',
    "stats_total_members" INTEGER NOT NULL DEFAULT 0,
    "stats_total_meetings" INTEGER NOT NULL DEFAULT 0,
    "stats_total_hours" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduled_time" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "created_by" UUID NOT NULL,
    "organization_id" UUID,
    "team_id" UUID,
    "privacy" TEXT NOT NULL DEFAULT 'public',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "room_id" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_end_date" TIMESTAMP(3),
    "recurrence_rrule" TEXT,
    "parent_recurrence_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_participants" (
    "meeting_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_participants_pkey" PRIMARY KEY ("meeting_id","user_id")
);

-- CreateTable
CREATE TABLE "meeting_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invite_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_recurrence_exceptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_meeting_id" UUID NOT NULL,
    "exception_date" TIMESTAMP(3) NOT NULL,
    "action" TEXT NOT NULL,
    "modified_meeting_id" UUID,

    CONSTRAINT "meeting_recurrence_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_recordings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_id" UUID,
    "organization_id" UUID,
    "team_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_name" TEXT,
    "file_size" BIGINT,
    "duration" DECIMAL(10,2),
    "format" TEXT DEFAULT 'mp4',
    "quality" TEXT DEFAULT '720p',
    "storage_provider" TEXT NOT NULL DEFAULT 'r2',
    "storage_path" TEXT,
    "download_url" TEXT,
    "streaming_url" TEXT,
    "thumbnail_url" TEXT,
    "transcript_status" TEXT NOT NULL DEFAULT 'pending',
    "transcript_text" TEXT,
    "transcript_language" TEXT NOT NULL DEFAULT 'en',
    "transcript_provider" TEXT,
    "summary_status" TEXT NOT NULL DEFAULT 'pending',
    "summary_text" TEXT,
    "summary_key_points" JSONB,
    "summary_topics" JSONB,
    "summary_sentiment" TEXT,
    "summary_sentiment_score" DECIMAL(4,3),
    "summary_provider" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'participants',
    "processing_status" TEXT NOT NULL DEFAULT 'uploading',
    "processing_progress" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archive_date" TIMESTAMP(3),
    "retention_delete_days" INTEGER,
    "retention_last_access" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_recording_transcript_segments" (
    "id" BIGSERIAL NOT NULL,
    "recording_id" UUID NOT NULL,
    "start_time" DECIMAL(8,2) NOT NULL,
    "end_time" DECIMAL(8,2) NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,

    CONSTRAINT "meeting_recording_transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_recording_action_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recording_id" UUID NOT NULL,
    "task" TEXT NOT NULL,
    "assignee" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'medium',

    CONSTRAINT "meeting_recording_action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_recording_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recording_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "join_time" TIMESTAMP(3),
    "leave_time" TIMESTAMP(3),
    "speaking_time" DECIMAL(10,2) NOT NULL DEFAULT 0.0,

    CONSTRAINT "meeting_recording_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "invited_by" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invite_token" TEXT NOT NULL,
    "message" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "accepted_by" UUID,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invited_user_id" UUID,
    "email" TEXT,
    "invited_by" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invite_token" TEXT NOT NULL,
    "message" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "accepted_by" UUID,

    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "meeting_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "channels" TEXT[],
    "sent_channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "job_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys_p256dh" TEXT NOT NULL,
    "keys_auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "error_message" TEXT,
    "error_code" TEXT,
    "error_stack" TEXT,
    "duration" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id","created_at")
);

-- CreateTable
CREATE TABLE "mongodb_postgres_key_map" (
    "collection_name" TEXT NOT NULL,
    "mongodb_id" TEXT NOT NULL,
    "postgresql_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mongodb_postgres_key_map_pkey" PRIMARY KEY ("collection_name","mongodb_id")
);

-- CreateTable
CREATE TABLE "calendar_integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "calendar_type" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expiry" TIMESTAMP(3) NOT NULL,
    "is_connected" BOOLEAN NOT NULL DEFAULT true,
    "last_sync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "organization_id" UUID,
    "team_id" UUID,
    "collaboration_mode" TEXT NOT NULL DEFAULT 'none',
    "active_tool" TEXT NOT NULL DEFAULT 'none',
    "participants" JSONB NOT NULL DEFAULT '[]',
    "workflow_data" JSONB NOT NULL DEFAULT '{}',
    "whiteboard_data" JSONB NOT NULL DEFAULT '{}',
    "code_data" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "action_items" TEXT[],
    "key_points" TEXT[],
    "participants" TEXT[],
    "duration" INTEGER NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "transcription" JSONB NOT NULL DEFAULT '[]',
    "insights" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_inquiries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "job_title" TEXT,
    "linkedin" TEXT,
    "company_name" TEXT NOT NULL,
    "company_size" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "country" TEXT,
    "primary_use_case" TEXT,
    "expected_users" TEXT,
    "current_solution" TEXT,
    "timeline" TEXT,
    "budget_range" TEXT,
    "requirements" TEXT,
    "message" TEXT,
    "is_startup" BOOLEAN NOT NULL DEFAULT false,
    "funding_stage" TEXT,
    "source" TEXT NOT NULL DEFAULT 'landing_page',
    "is_authenticated" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'new',
    "assigned_to" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" JSONB NOT NULL DEFAULT '[]',
    "follow_up_date" TIMESTAMP(3),
    "last_contacted_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "closed_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enterprise_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action" TEXT NOT NULL,
    "user_id" UUID,
    "organization_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_organization_memberships_user_id_organization_id_key" ON "user_organization_memberships"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "teams_organization_id_idx" ON "teams"("organization_id");

-- CreateIndex
CREATE INDEX "teams_owner_id_idx" ON "teams"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organization_id_slug_key" ON "teams"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_meeting_id_key" ON "meetings"("meeting_id");

-- CreateIndex
CREATE INDEX "meetings_organization_id_idx" ON "meetings"("organization_id");

-- CreateIndex
CREATE INDEX "meetings_team_id_idx" ON "meetings"("team_id");

-- CreateIndex
CREATE INDEX "meetings_created_by_idx" ON "meetings"("created_by");

-- CreateIndex
CREATE INDEX "meetings_scheduled_time_idx" ON "meetings"("scheduled_time");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_invites_invite_token_key" ON "meeting_invites"("invite_token");

-- CreateIndex
CREATE INDEX "meeting_recordings_meeting_id_idx" ON "meeting_recordings"("meeting_id");

-- CreateIndex
CREATE INDEX "meeting_recordings_organization_id_idx" ON "meeting_recordings"("organization_id");

-- CreateIndex
CREATE INDEX "meeting_recordings_team_id_idx" ON "meeting_recordings"("team_id");

-- CreateIndex
CREATE INDEX "idx_recording_segments_recording_id" ON "meeting_recording_transcript_segments"("recording_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_invite_token_key" ON "organization_invitations"("invite_token");

-- CreateIndex
CREATE UNIQUE INDEX "team_invitations_invite_token_key" ON "team_invitations"("invite_token");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_integrations_user_id_calendar_type_key" ON "calendar_integrations"("user_id", "calendar_type");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_room_id_key" ON "rooms"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_summaries_meeting_id_key" ON "meeting_summaries"("meeting_id");

-- CreateIndex
CREATE INDEX "activities_organization_id_idx" ON "activities"("organization_id");

-- CreateIndex
CREATE INDEX "activities_user_id_idx" ON "activities"("user_id");

-- CreateIndex
CREATE INDEX "activities_action_idx" ON "activities"("action");

-- AddForeignKey
ALTER TABLE "user_usage" ADD CONSTRAINT "user_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organization_memberships" ADD CONSTRAINT "user_organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organization_memberships" ADD CONSTRAINT "user_organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_parent_recurrence_id_fkey" FOREIGN KEY ("parent_recurrence_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_invites" ADD CONSTRAINT "meeting_invites_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recurrence_exceptions" ADD CONSTRAINT "meeting_recurrence_exceptions_parent_meeting_id_fkey" FOREIGN KEY ("parent_meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recordings" ADD CONSTRAINT "meeting_recordings_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recordings" ADD CONSTRAINT "meeting_recordings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recordings" ADD CONSTRAINT "meeting_recordings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recording_transcript_segments" ADD CONSTRAINT "meeting_recording_transcript_segments_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "meeting_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recording_action_items" ADD CONSTRAINT "meeting_recording_action_items_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "meeting_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recording_participants" ADD CONSTRAINT "meeting_recording_participants_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "meeting_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recording_participants" ADD CONSTRAINT "meeting_recording_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

