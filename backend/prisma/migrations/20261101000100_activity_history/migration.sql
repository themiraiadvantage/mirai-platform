CREATE TABLE "ActivityEvent" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "targetId" TEXT,
  "targetLabel" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "changes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityEvent_category_check" CHECK ("category" IN ('AUTH', 'STAFF', 'SETTINGS', 'ANNOUNCEMENTS'))
);
CREATE INDEX "ActivityEvent_createdAt_id_idx" ON "ActivityEvent"("createdAt", "id");
CREATE INDEX "ActivityEvent_category_createdAt_idx" ON "ActivityEvent"("category", "createdAt");
CREATE INDEX "ActivityEvent_actorId_createdAt_idx" ON "ActivityEvent"("actorId", "createdAt");
CREATE FUNCTION "preserve_activity_event"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Activity events cannot be edited or deleted';
END;
$$;
CREATE TRIGGER "ActivityEvent_append_only" BEFORE UPDATE OR DELETE ON "ActivityEvent"
  FOR EACH ROW EXECUTE FUNCTION "preserve_activity_event"();
