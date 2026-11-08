CREATE TABLE "push_subscription" (
	"token" text PRIMARY KEY,
	"session_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "push_subscription_session_id_idx" ON "push_subscription" ("session_id");--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;