CREATE TABLE "product" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"image" text,
	"purchasable" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe" (
	"id" text PRIMARY KEY,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"image" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"duration_minutes" integer NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_product" (
	"recipe_id" text,
	"product_id" text,
	"position" integer NOT NULL,
	"usage" text NOT NULL,
	CONSTRAINT "recipe_product_pkey" PRIMARY KEY("recipe_id","product_id")
);
--> statement-breakpoint
CREATE INDEX "recipe_created_at_idx" ON "recipe" ("created_at");--> statement-breakpoint
CREATE INDEX "recipe_author_id_idx" ON "recipe" ("author_id");--> statement-breakpoint
CREATE INDEX "recipe_product_product_id_idx" ON "recipe_product" ("product_id");--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_author_id_user_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recipe_product" ADD CONSTRAINT "recipe_product_recipe_id_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recipe_product" ADD CONSTRAINT "recipe_product_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT;