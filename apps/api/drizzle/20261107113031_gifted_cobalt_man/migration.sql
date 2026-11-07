CREATE TABLE "recipe_step" (
	"recipe_id" text,
	"position" integer,
	"part" text NOT NULL,
	"label" text NOT NULL,
	"title" text NOT NULL,
	"hint" text NOT NULL,
	"product" text NOT NULL,
	"colors" text[] NOT NULL,
	CONSTRAINT "recipe_step_pkey" PRIMARY KEY("recipe_id","position")
);
--> statement-breakpoint
ALTER TABLE "recipe_step" ADD CONSTRAINT "recipe_step_recipe_id_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE;