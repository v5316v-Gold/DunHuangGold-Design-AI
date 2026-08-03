# Schema Dump · Phase 0 Baseline

**Generated**: 2026-08-03T13:03:31.353Z
**Database**: postgresql://***:***@localhost:5432/dunhuang

## 1. Table Row Counts

| Table | Rows |
|---|---|
| api_configs | 0 |
| app_settings | 0 |
| audit_logs | 0 |
| comfyui_configs | 0 |
| comfyui_connections | 0 |
| comfyui_execution_logs | 0 |
| favorites | 0 |
| features | 17 |
| health_check | 0 |
| loras | 0 |
| power_logs | 2 |
| power_transactions | 0 |
| prompt_rules | 0 |
| sessions | 0 |
| system_settings | 0 |
| tasks | 0 |
| translate_settings | 0 |
| users | 8 |
| workflow_templates | 3 |
| workflows | 0 |
| works | 1 |

**Total tables**: 21

## 2. Columns (235)

| Table | Column | Type | Nullable | Default |
|---|---|---|---|---|
| api_configs | id | character varying | NO |  |
| api_configs | name | character varying | NO |  |
| api_configs | api_key | text | YES |  |
| api_configs | provider | character varying | YES |  |
| api_configs | model | character varying | YES |  |
| api_configs | url | text | YES |  |
| api_configs | method | character varying | NO | 'POST'::character varying |
| api_configs | enabled | boolean | NO | false |
| api_configs | timeout | integer | NO | 30000 |
| api_configs | headers | jsonb | YES | '{}'::jsonb |
| api_configs | param_mapping | jsonb | YES | '{}'::jsonb |
| api_configs | response_mapping | jsonb | YES | '{}'::jsonb |
| api_configs | fallback | jsonb | YES | '{}'::jsonb |
| api_configs | description | text | YES |  |
| api_configs | last_tested | timestamp without time zone | YES |  |
| api_configs | test_result | character varying | YES |  |
| api_configs | app_id | text | YES |  |
| api_configs | disable_thought_chain | boolean | YES | false |
| api_configs | enable_advanced_params | boolean | YES | false |
| api_configs | filter_thought_output | boolean | YES | false |
| api_configs | translate_model | character varying | YES |  |
| api_configs | optimize_model | character varying | YES |  |
| api_configs | vlm_model | character varying | YES |  |
| api_configs | show_on_assistant | boolean | YES | false |
| api_configs | created_at | timestamp without time zone | NO | now() |
| api_configs | updated_at | timestamp without time zone | NO | now() |
| app_settings | id | character varying | NO |  |
| app_settings | translate_settings | jsonb | YES | '{}'::jsonb |
| app_settings | interface_settings | jsonb | YES | '{}'::jsonb |
| app_settings | system_settings | jsonb | YES | '{}'::jsonb |
| app_settings | feature_switches | jsonb | YES | '{}'::jsonb |
| app_settings | selected_services | jsonb | YES | '{}'::jsonb |
| app_settings | created_at | timestamp without time zone | YES | now() |
| app_settings | updated_at | timestamp without time zone | YES | now() |
| audit_logs | id | uuid | NO | gen_random_uuid() |
| audit_logs | actor_id | uuid | YES |  |
| audit_logs | actor_email | character varying | YES |  |
| audit_logs | actor_role | character varying | YES |  |
| audit_logs | action | character varying | NO |  |
| audit_logs | resource_type | character varying | NO |  |
| audit_logs | resource_id | character varying | YES |  |
| audit_logs | details | jsonb | YES | '{}'::jsonb |
| audit_logs | ip_address | character varying | YES |  |
| audit_logs | user_agent | text | YES |  |
| audit_logs | created_at | timestamp without time zone | NO | now() |
| comfyui_configs | id | character varying | NO |  |
| comfyui_configs | feature_id | character varying | NO |  |
| comfyui_configs | workflow_id | character varying | YES |  |
| comfyui_configs | workflow_json | jsonb | YES |  |
| comfyui_configs | node_mapping | jsonb | YES |  |
| comfyui_configs | default_params | jsonb | YES |  |
| comfyui_configs | fixed_params | jsonb | YES |  |
| comfyui_configs | connection_id | character varying | YES |  |
| comfyui_configs | enabled | boolean | NO | true |
| comfyui_configs | is_default | boolean | YES | false |
| comfyui_configs | description | text | YES |  |
| comfyui_configs | execution_count | integer | YES | 0 |
| comfyui_configs | last_executed_at | timestamp without time zone | YES |  |
| comfyui_configs | created_at | timestamp without time zone | YES | now() |
| comfyui_configs | updated_at | timestamp without time zone | YES | now() |
| comfyui_connections | id | character varying | NO |  |
| comfyui_connections | name | character varying | NO |  |
| comfyui_connections | host | character varying | NO |  |
| comfyui_connections | port | integer | YES | 8188 |
| comfyui_connections | auth_token | text | YES |  |
| comfyui_connections | enabled | boolean | YES | true |
| comfyui_connections | is_default | boolean | YES | false |
| comfyui_connections | priority | integer | YES | 0 |
| comfyui_connections | timeout | integer | YES | 120000 |
| comfyui_connections | created_at | timestamp without time zone | YES | now() |
| comfyui_connections | updated_at | timestamp without time zone | YES | now() |
| comfyui_execution_logs | id | integer | NO | nextval('comfyui_execution_logs_id_seq'::regclass) |
| comfyui_execution_logs | workflow_id | character varying | NO |  |
| comfyui_execution_logs | feature_id | character varying | NO |  |
| comfyui_execution_logs | prompt_id | character varying | YES |  |
| comfyui_execution_logs | params | jsonb | NO |  |
| comfyui_execution_logs | status | character varying | NO |  |
| comfyui_execution_logs | execution_time_ms | integer | YES |  |
| comfyui_execution_logs | error_message | text | YES |  |
| comfyui_execution_logs | result | jsonb | YES |  |
| comfyui_execution_logs | created_at | timestamp without time zone | YES | now() |
| favorites | id | uuid | NO | gen_random_uuid() |
| favorites | user_id | uuid | NO |  |
| favorites | work_id | uuid | NO |  |
| favorites | created_at | timestamp without time zone | NO | now() |
| features | id | character varying | NO |  |
| features | name | character varying | NO |  |
| features | description | text | YES |  |
| features | category | character varying | NO |  |
| features | icon | character varying | YES |  |
| features | cost | integer | NO | 10 |
| features | enabled | boolean | NO | true |
| features | default_executor | character varying | NO | 'third-party'::character varying |
| features | fallback_executors | jsonb | YES | '[]'::jsonb |
| features | workflow_id | character varying | YES |  |
| features | loras | jsonb | YES | '[]'::jsonb |
| features | default_model | character varying | YES |  |
| features | default_params | jsonb | YES | '{}'::jsonb |
| features | sort_order | integer | NO | 0 |
| features | display_group | character varying | YES |  |
| features | supports_ai_assistant | boolean | YES | false |
| features | created_at | timestamp without time zone | NO | now() |
| features | updated_at | timestamp without time zone | NO | now() |
| features | updated_by | uuid | YES |  |
| health_check | id | integer | NO | nextval('health_check_id_seq'::regclass) |
| health_check | updated_at | timestamp with time zone | YES | now() |
| loras | id | uuid | NO | gen_random_uuid() |
| loras | name | character varying | NO |  |
| loras | description | text | YES |  |
| loras | trigger_words | ARRAY | NO | '{}'::text[] |
| loras | file_path | character varying | NO |  |
| loras | file_hash | character varying | YES |  |
| loras | file_size | bigint | YES |  |
| loras | base_model | character varying | YES |  |
| loras | scope | ARRAY | NO | '{}'::text[] |
| loras | preview_image | character varying | YES |  |
| loras | enabled | boolean | NO | true |
| loras | uploaded_by | uuid | YES |  |
| loras | created_at | timestamp without time zone | NO | now() |
| loras | updated_at | timestamp without time zone | NO | now() |
| power_logs | id | uuid | NO | gen_random_uuid() |
| power_logs | user_id | uuid | NO |  |
| power_logs | type | character varying | NO |  |
| power_logs | amount | integer | NO |  |
| power_logs | balance | integer | NO |  |
| power_logs | reason | character varying | YES |  |
| power_logs | related_id | character varying | YES |  |
| power_logs | created_at | timestamp without time zone | NO | now() |
| power_transactions | id | uuid | NO | gen_random_uuid() |
| power_transactions | user_id | uuid | NO |  |
| power_transactions | user_email | character varying | YES |  |
| power_transactions | user_nickname | character varying | YES |  |
| power_transactions | type | character varying | NO |  |
| power_transactions | amount | integer | NO |  |
| power_transactions | balance_before | integer | NO |  |
| power_transactions | balance_after | integer | NO |  |
| power_transactions | reason | text | YES |  |
| power_transactions | operator_id | uuid | YES |  |
| power_transactions | operator_email | character varying | YES |  |
| power_transactions | related_id | character varying | YES |  |
| power_transactions | created_at | timestamp without time zone | NO | now() |
| prompt_rules | id | character varying | NO |  |
| prompt_rules | category | character varying | NO |  |
| prompt_rules | name | character varying | NO |  |
| prompt_rules | system_prompt | text | NO |  |
| prompt_rules | enabled | boolean | NO | true |
| prompt_rules | sort_order | integer | YES | 0 |
| prompt_rules | created_at | timestamp without time zone | NO | now() |
| prompt_rules | updated_at | timestamp without time zone | NO | now() |
| sessions | id | uuid | NO | gen_random_uuid() |
| sessions | user_id | uuid | NO |  |
| sessions | token | character varying | NO |  |
| sessions | user_agent | text | YES |  |
| sessions | ip_address | character varying | YES |  |
| sessions | expires_at | timestamp without time zone | NO |  |
| sessions | created_at | timestamp without time zone | NO | now() |
| system_settings | key | character varying | NO |  |
| system_settings | value | jsonb | NO |  |
| system_settings | description | text | YES |  |
| system_settings | updated_at | timestamp without time zone | NO | now() |
| tasks | id | uuid | NO | gen_random_uuid() |
| tasks | user_id | uuid | NO |  |
| tasks | type | character varying | NO |  |
| tasks | status | character varying | NO | 'pending'::character varying |
| tasks | input | jsonb | NO |  |
| tasks | output | jsonb | YES |  |
| tasks | error | text | YES |  |
| tasks | progress | integer | YES | 0 |
| tasks | power_cost | integer | YES | 0 |
| tasks | created_at | timestamp without time zone | NO | now() |
| tasks | started_at | timestamp without time zone | YES |  |
| tasks | completed_at | timestamp without time zone | YES |  |
| tasks | feature_code | character varying | YES |  |
| tasks | executor | character varying | YES |  |
| tasks | retry_count | integer | NO | 0 |
| tasks | max_retries | integer | NO | 3 |
| tasks | cancelled_at | timestamp without time zone | YES |  |
| translate_settings | id | character varying | NO |  |
| translate_settings | preserve_newline | boolean | YES | true |
| translate_settings | remove_redundant_dots | boolean | YES | false |
| translate_settings | remove_extra_spaces | boolean | YES | false |
| translate_settings | halfwidth_punctuation | boolean | YES | false |
| translate_settings | mixed_lang_rule | character varying | YES | 'to_en'::character varying |
| translate_settings | cache_mixed_lang | boolean | YES | false |
| translate_settings | use_cache | boolean | YES | true |
| translate_settings | created_at | timestamp without time zone | YES | now() |
| translate_settings | updated_at | timestamp without time zone | YES | now() |
| users | id | uuid | NO | gen_random_uuid() |
| users | email | character varying | NO |  |
| users | password_hash | character varying | NO |  |
| users | nickname | character varying | YES |  |
| users | avatar | text | YES |  |
| users | role | character varying | NO | 'user'::character varying |
| users | status | character varying | NO | 'active'::character varying |
| users | power | integer | NO | 100 |
| users | created_at | timestamp without time zone | NO | now() |
| users | updated_at | timestamp without time zone | NO | now() |
| users | last_login_at | timestamp without time zone | YES |  |
| workflow_templates | id | uuid | NO | gen_random_uuid() |
| workflow_templates | name | character varying | NO |  |
| workflow_templates | service_type | character varying | NO |  |
| workflow_templates | version | integer | NO | 1 |
| workflow_templates | workflow_json | jsonb | NO |  |
| workflow_templates | input_schema | jsonb | YES |  |
| workflow_templates | comfyui_version | character varying | YES |  |
| workflow_templates | required_custom_nodes | ARRAY | YES | '{}'::text[] |
| workflow_templates | enabled | boolean | NO | true |
| workflow_templates | description | text | YES |  |
| workflow_templates | created_at | timestamp without time zone | NO | now() |
| workflow_templates | updated_at | timestamp without time zone | NO | now() |
| workflows | id | character varying | NO |  |
| workflows | name | character varying | NO |  |
| workflows | description | text | YES |  |
| workflows | workflow_json | jsonb | NO |  |
| workflows | comfyui_host | character varying | YES |  |
| workflows | enabled | boolean | NO | true |
| workflows | last_executed | timestamp without time zone | YES |  |
| workflows | execution_count | integer | YES | 0 |
| workflows | created_at | timestamp without time zone | NO | now() |
| workflows | updated_at | timestamp without time zone | NO | now() |
| works | id | uuid | NO | gen_random_uuid() |
| works | user_id | uuid | NO |  |
| works | title | character varying | YES |  |
| works | type | character varying | NO |  |
| works | prompt | text | YES |  |
| works | input_image_url | text | YES |  |
| works | output_image_url | text | YES |  |
| works | output_video_url | text | YES |  |
| works | output_model_url | text | YES |  |
| works | params | jsonb | YES | '{}'::jsonb |
| works | power_cost | integer | YES | 0 |
| works | status | character varying | NO | 'completed'::character varying |
| works | is_public | boolean | NO | false |
| works | created_at | timestamp without time zone | NO | now() |
| works | feature_code | character varying | YES |  |

## 3. Indexes (38)

| Table | Index | Definition |
|---|---|---|
| api_configs | api_configs_pkey | `CREATE UNIQUE INDEX api_configs_pkey ON public.api_configs USING btree (id)` |
| app_settings | app_settings_pkey | `CREATE UNIQUE INDEX app_settings_pkey ON public.app_settings USING btree (id)` |
| audit_logs | audit_action_idx | `CREATE INDEX audit_action_idx ON public.audit_logs USING btree (action)` |
| audit_logs | audit_actor_idx | `CREATE INDEX audit_actor_idx ON public.audit_logs USING btree (actor_id, created_at)` |
| audit_logs | audit_logs_pkey | `CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id)` |
| audit_logs | audit_resource_idx | `CREATE INDEX audit_resource_idx ON public.audit_logs USING btree (resource_type, resource_id)` |
| comfyui_configs | comfyui_configs_pkey | `CREATE UNIQUE INDEX comfyui_configs_pkey ON public.comfyui_configs USING btree (id)` |
| comfyui_connections | comfyui_connections_pkey | `CREATE UNIQUE INDEX comfyui_connections_pkey ON public.comfyui_connections USING btree (id)` |
| comfyui_execution_logs | comfyui_execution_logs_pkey | `CREATE UNIQUE INDEX comfyui_execution_logs_pkey ON public.comfyui_execution_logs USING btree (id)` |
| favorites | favorites_pkey | `CREATE UNIQUE INDEX favorites_pkey ON public.favorites USING btree (id)` |
| favorites | idx_favorites_user_id | `CREATE INDEX idx_favorites_user_id ON public.favorites USING btree (user_id)` |
| favorites | idx_favorites_work_id | `CREATE INDEX idx_favorites_work_id ON public.favorites USING btree (work_id)` |
| features | features_pkey | `CREATE UNIQUE INDEX features_pkey ON public.features USING btree (id)` |
| loras | idx_loras_enabled | `CREATE INDEX idx_loras_enabled ON public.loras USING btree (enabled) WHERE (enabled = true)` |
| loras | idx_loras_scope | `CREATE INDEX idx_loras_scope ON public.loras USING gin (scope)` |
| loras | loras_pkey | `CREATE UNIQUE INDEX loras_pkey ON public.loras USING btree (id)` |
| power_logs | power_logs_pkey | `CREATE UNIQUE INDEX power_logs_pkey ON public.power_logs USING btree (id)` |
| power_transactions | idx_pt_created_at | `CREATE INDEX idx_pt_created_at ON public.power_transactions USING btree (created_at DESC)` |
| power_transactions | idx_pt_operator_id | `CREATE INDEX idx_pt_operator_id ON public.power_transactions USING btree (operator_id)` |
| power_transactions | idx_pt_type | `CREATE INDEX idx_pt_type ON public.power_transactions USING btree (type)` |
| power_transactions | idx_pt_user_id | `CREATE INDEX idx_pt_user_id ON public.power_transactions USING btree (user_id)` |
| power_transactions | power_transactions_pkey | `CREATE UNIQUE INDEX power_transactions_pkey ON public.power_transactions USING btree (id)` |
| prompt_rules | prompt_rules_pkey | `CREATE UNIQUE INDEX prompt_rules_pkey ON public.prompt_rules USING btree (id)` |
| sessions | sessions_pkey | `CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id)` |
| sessions | sessions_token_unique | `CREATE UNIQUE INDEX sessions_token_unique ON public.sessions USING btree (token)` |
| system_settings | system_settings_pkey | `CREATE UNIQUE INDEX system_settings_pkey ON public.system_settings USING btree (key)` |
| tasks | idx_tasks_created_at | `CREATE INDEX idx_tasks_created_at ON public.tasks USING btree (created_at)` |
| tasks | idx_tasks_feature_code | `CREATE INDEX idx_tasks_feature_code ON public.tasks USING btree (feature_code)` |
| tasks | idx_tasks_status | `CREATE INDEX idx_tasks_status ON public.tasks USING btree (status)` |
| tasks | tasks_pkey | `CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id)` |
| translate_settings | translate_settings_pkey | `CREATE UNIQUE INDEX translate_settings_pkey ON public.translate_settings USING btree (id)` |
| users | users_email_unique | `CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email)` |
| users | users_pkey | `CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)` |
| workflow_templates | idx_workflow_templates_service | `CREATE INDEX idx_workflow_templates_service ON public.workflow_templates USING btree (service_type, enabled) WHERE (enabled = true)` |
| workflow_templates | workflow_templates_name_key | `CREATE UNIQUE INDEX workflow_templates_name_key ON public.workflow_templates USING btree (name)` |
| workflow_templates | workflow_templates_pkey | `CREATE UNIQUE INDEX workflow_templates_pkey ON public.workflow_templates USING btree (id)` |
| workflows | workflows_pkey | `CREATE UNIQUE INDEX workflows_pkey ON public.workflows USING btree (id)` |
| works | works_pkey | `CREATE UNIQUE INDEX works_pkey ON public.works USING btree (id)` |

## 4. Constraints (143)

| Table | Constraint | Type |
|---|---|---|
| api_configs | api_configs_created_at_not_null | n |
| api_configs | api_configs_enabled_not_null | n |
| api_configs | api_configs_id_not_null | n |
| api_configs | api_configs_method_not_null | n |
| api_configs | api_configs_name_not_null | n |
| api_configs | api_configs_pkey | p |
| api_configs | api_configs_timeout_not_null | n |
| api_configs | api_configs_updated_at_not_null | n |
| app_settings | app_settings_id_not_null | n |
| app_settings | app_settings_pkey | p |
| audit_logs | audit_logs_action_not_null | n |
| audit_logs | audit_logs_actor_id_fkey | f |
| audit_logs | audit_logs_created_at_not_null | n |
| audit_logs | audit_logs_id_not_null | n |
| audit_logs | audit_logs_pkey | p |
| audit_logs | audit_logs_resource_type_not_null | n |
| comfyui_configs | comfyui_configs_enabled_not_null | n |
| comfyui_configs | comfyui_configs_feature_id_not_null | n |
| comfyui_configs | comfyui_configs_id_not_null | n |
| comfyui_configs | comfyui_configs_pkey | p |
| comfyui_connections | comfyui_connections_host_not_null | n |
| comfyui_connections | comfyui_connections_id_not_null | n |
| comfyui_connections | comfyui_connections_name_not_null | n |
| comfyui_connections | comfyui_connections_pkey | p |
| comfyui_execution_logs | comfyui_execution_logs_feature_id_not_null | n |
| comfyui_execution_logs | comfyui_execution_logs_id_not_null | n |
| comfyui_execution_logs | comfyui_execution_logs_params_not_null | n |
| comfyui_execution_logs | comfyui_execution_logs_pkey | p |
| comfyui_execution_logs | comfyui_execution_logs_status_not_null | n |
| comfyui_execution_logs | comfyui_execution_logs_workflow_id_not_null | n |
| favorites | favorites_created_at_not_null | n |
| favorites | favorites_id_not_null | n |
| favorites | favorites_pkey | p |
| favorites | favorites_user_id_not_null | n |
| favorites | favorites_user_id_users_id_fk | f |
| favorites | favorites_work_id_not_null | n |
| favorites | favorites_work_id_works_id_fk | f |
| features | features_category_not_null | n |
| features | features_cost_not_null | n |
| features | features_created_at_not_null | n |
| features | features_default_executor_not_null | n |
| features | features_enabled_not_null | n |
| features | features_id_not_null | n |
| features | features_name_not_null | n |
| features | features_pkey | p |
| features | features_sort_order_not_null | n |
| features | features_updated_at_not_null | n |
| features | features_updated_by_fkey | f |
| health_check | health_check_id_not_null | n |
| loras | loras_created_at_not_null | n |
| loras | loras_enabled_not_null | n |
| loras | loras_file_path_not_null | n |
| loras | loras_id_not_null | n |
| loras | loras_name_not_null | n |
| loras | loras_pkey | p |
| loras | loras_scope_not_null | n |
| loras | loras_trigger_words_not_null | n |
| loras | loras_updated_at_not_null | n |
| loras | loras_uploaded_by_fkey | f |
| power_logs | power_logs_amount_not_null | n |
| power_logs | power_logs_balance_not_null | n |
| power_logs | power_logs_created_at_not_null | n |
| power_logs | power_logs_id_not_null | n |
| power_logs | power_logs_pkey | p |
| power_logs | power_logs_type_not_null | n |
| power_logs | power_logs_user_id_not_null | n |
| power_logs | power_logs_user_id_users_id_fk | f |
| power_transactions | power_transactions_amount_not_null | n |
| power_transactions | power_transactions_balance_after_not_null | n |
| power_transactions | power_transactions_balance_before_not_null | n |
| power_transactions | power_transactions_created_at_not_null | n |
| power_transactions | power_transactions_id_not_null | n |
| power_transactions | power_transactions_pkey | p |
| power_transactions | power_transactions_type_not_null | n |
| power_transactions | power_transactions_user_id_fkey | f |
| power_transactions | power_transactions_user_id_not_null | n |
| prompt_rules | prompt_rules_category_not_null | n |
| prompt_rules | prompt_rules_created_at_not_null | n |
| prompt_rules | prompt_rules_enabled_not_null | n |
| prompt_rules | prompt_rules_id_not_null | n |
| prompt_rules | prompt_rules_name_not_null | n |
| prompt_rules | prompt_rules_pkey | p |
| prompt_rules | prompt_rules_system_prompt_not_null | n |
| prompt_rules | prompt_rules_updated_at_not_null | n |
| sessions | sessions_created_at_not_null | n |
| sessions | sessions_expires_at_not_null | n |
| sessions | sessions_id_not_null | n |
| sessions | sessions_pkey | p |
| sessions | sessions_token_not_null | n |
| sessions | sessions_token_unique | u |
| sessions | sessions_user_id_not_null | n |
| sessions | sessions_user_id_users_id_fk | f |
| system_settings | system_settings_key_not_null | n |
| system_settings | system_settings_pkey | p |
| system_settings | system_settings_updated_at_not_null | n |
| system_settings | system_settings_value_not_null | n |
| tasks | tasks_created_at_not_null | n |
| tasks | tasks_id_not_null | n |
| tasks | tasks_input_not_null | n |
| tasks | tasks_max_retries_not_null | n |
| tasks | tasks_pkey | p |
| tasks | tasks_retry_count_not_null | n |
| tasks | tasks_status_not_null | n |
| tasks | tasks_type_not_null | n |
| tasks | tasks_user_id_not_null | n |
| tasks | tasks_user_id_users_id_fk | f |
| translate_settings | translate_settings_id_not_null | n |
| translate_settings | translate_settings_pkey | p |
| users | users_created_at_not_null | n |
| users | users_email_not_null | n |
| users | users_email_unique | u |
| users | users_id_not_null | n |
| users | users_password_hash_not_null | n |
| users | users_pkey | p |
| users | users_power_not_null | n |
| users | users_role_not_null | n |
| users | users_status_not_null | n |
| users | users_updated_at_not_null | n |
| workflow_templates | workflow_templates_created_at_not_null | n |
| workflow_templates | workflow_templates_enabled_not_null | n |
| workflow_templates | workflow_templates_id_not_null | n |
| workflow_templates | workflow_templates_name_key | u |
| workflow_templates | workflow_templates_name_not_null | n |
| workflow_templates | workflow_templates_pkey | p |
| workflow_templates | workflow_templates_service_type_not_null | n |
| workflow_templates | workflow_templates_updated_at_not_null | n |
| workflow_templates | workflow_templates_version_not_null | n |
| workflow_templates | workflow_templates_workflow_json_not_null | n |
| workflows | workflows_created_at_not_null | n |
| workflows | workflows_enabled_not_null | n |
| workflows | workflows_id_not_null | n |
| workflows | workflows_name_not_null | n |
| workflows | workflows_pkey | p |
| workflows | workflows_updated_at_not_null | n |
| workflows | workflows_workflow_json_not_null | n |
| works | works_created_at_not_null | n |
| works | works_id_not_null | n |
| works | works_is_public_not_null | n |
| works | works_pkey | p |
| works | works_status_not_null | n |
| works | works_type_not_null | n |
| works | works_user_id_not_null | n |
| works | works_user_id_users_id_fk | f |
