ALTER TABLE "recipe" ADD COLUMN "part" text;--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "summary" text;--> statement-breakpoint
CREATE INDEX "recipe_part_idx" ON "recipe" ("part");