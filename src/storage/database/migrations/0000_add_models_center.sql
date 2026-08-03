CREATE TABLE "api_configs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"api_key" text,
	"provider" varchar(50),
	"model" varchar(100),
	"url" text,
	"method" varchar(10) DEFAULT 'POST' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"timeout" integer DEFAULT 30000 NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"param_mapping" jsonb DEFAULT '{}'::jsonb,
	"response_mapping" jsonb DEFAULT '{}'::jsonb,
	"fallback" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"last_tested" timestamp,
	"test_result" varchar(20),
	"app_id" text,
	"disable_thought_chain" boolean DEFAULT false,
	"enable_advanced_params" boolean DEFAULT false,
	"filter_thought_output" boolean DEFAULT false,
	"translate_model" varchar(100),
	"optimize_model" varchar(100),
	"vlm_model" varchar(100),
	"show_on_assistant" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"translate_settings" jsonb DEFAULT '{}'::jsonb,
	"interface_settings" jsonb DEFAULT '{}'::jsonb,
	"system_settings" jsonb DEFAULT '{}'::jsonb,
	"feature_switches" jsonb DEFAULT '{}'::jsonb,
	"selected_services" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_email" varchar(255),
	"actor_role" varchar(20),
	"action" varchar(50) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" varchar(100),
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comfyui_configs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"feature_id" varchar(50) NOT NULL,
	"workflow_id" varchar(100),
	"workflow_json" jsonb,
	"node_mapping" jsonb,
	"default_params" jsonb,
	"fixed_params" jsonb,
	"connection_id" varchar(50),
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false,
	"description" text,
	"execution_count" integer DEFAULT 0,
	"last_executed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comfyui_connections" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer DEFAULT 8188,
	"auth_token" text,
	"enabled" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"priority" integer DEFAULT 0,
	"timeout" integer DEFAULT 120000,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comfyui_execution_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" varchar(50) NOT NULL,
	"feature_id" varchar(50) NOT NULL,
	"prompt_id" varchar(100),
	"params" jsonb NOT NULL,
	"status" varchar(20) NOT NULL,
	"execution_time_ms" integer,
	"error_message" text,
	"result" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_check" (
	"id" serial NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_type" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"file_path" text,
	"original_filename" varchar(255),
	"version" varchar(30) DEFAULT '1.0.0',
	"file_size" bigint DEFAULT 0,
	"sha256" varchar(64),
	"bound_features" jsonb DEFAULT '[]'::jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger_words" jsonb DEFAULT '[]'::jsonb,
	"base_model" varchar(100),
	"weight" numeric(3, 2) DEFAULT '0.8',
	"description" text,
	"uploaded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"reason" varchar(255),
	"related_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_email" varchar(255),
	"user_nickname" varchar(100),
	"type" varchar(20) NOT NULL,
	"amount" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text,
	"operator_id" uuid,
	"operator_email" varchar(255),
	"related_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_rules" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"category" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"system_prompt" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"user_agent" text,
	"ip_address" varchar(45),
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"progress" integer DEFAULT 0,
	"power_cost" integer DEFAULT 0,
	"feature_code" varchar(50),
	"executor" varchar(50),
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "translate_settings" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"preserve_newline" boolean DEFAULT true,
	"remove_redundant_dots" boolean DEFAULT false,
	"remove_extra_spaces" boolean DEFAULT false,
	"halfwidth_punctuation" boolean DEFAULT false,
	"mixed_lang_rule" varchar(20) DEFAULT 'to_en',
	"cache_mixed_lang" boolean DEFAULT false,
	"use_cache" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"nickname" varchar(100),
	"avatar" text,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"power" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"workflow_json" jsonb NOT NULL,
	"comfyui_host" varchar(255),
	"enabled" boolean DEFAULT true NOT NULL,
	"last_executed" timestamp,
	"execution_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255),
	"type" varchar(50) NOT NULL,
	"feature_code" varchar(50),
	"prompt" text,
	"input_image_url" text,
	"output_image_url" text,
	"output_video_url" text,
	"output_model_url" text,
	"params" jsonb DEFAULT '{}'::jsonb,
	"power_cost" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_logs" ADD CONSTRAINT "power_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_transactions" ADD CONSTRAINT "power_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "models_type_idx" ON "models" USING btree ("model_type");--> statement-breakpoint
CREATE INDEX "models_enabled_idx" ON "models" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "models_sha_idx" ON "models" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "idx_pt_user_id" ON "power_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pt_type" ON "power_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_pt_created_at" ON "power_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_pt_operator_id" ON "power_transactions" USING btree ("operator_id");