CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plan_snapshot_at" timestamp with time zone NOT NULL,
	CONSTRAINT "shopping_lists_plan_id_unique" UNIQUE("plan_id")
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"list_id" uuid NOT NULL,
	"display_order" integer NOT NULL,
	"item" text NOT NULL,
	"quantity" numeric(10, 4),
	"unit" text,
	"checked" boolean DEFAULT false NOT NULL,
	"custom" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_plan_id_meal_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;
