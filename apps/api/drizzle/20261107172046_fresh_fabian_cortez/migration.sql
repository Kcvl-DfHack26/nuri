CREATE TABLE "recipe_favorite" (
	"user_id" text,
	"recipe_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_favorite_pkey" PRIMARY KEY("user_id","recipe_id")
);
--> statement-breakpoint
CREATE INDEX "recipe_favorite_recipe_id_idx" ON "recipe_favorite" ("recipe_id");--> statement-breakpoint
ALTER TABLE "recipe_favorite" ADD CONSTRAINT "recipe_favorite_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recipe_favorite" ADD CONSTRAINT "recipe_favorite_recipe_id_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE;