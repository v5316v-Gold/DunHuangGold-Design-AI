--
-- PostgreSQL database dump
--

\restrict vM5HAoePyYdDJxf8ocn1gsTankDLnl2FOQUWpW0pv2wI4Hbd49LbhyEzHBojiSZ

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_configs (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    api_key text,
    provider character varying(50),
    model character varying(100),
    url text,
    method character varying(10) DEFAULT 'POST'::character varying NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    timeout integer DEFAULT 30000 NOT NULL,
    headers jsonb DEFAULT '{}'::jsonb,
    param_mapping jsonb DEFAULT '{}'::jsonb,
    response_mapping jsonb DEFAULT '{}'::jsonb,
    fallback jsonb DEFAULT '{}'::jsonb,
    description text,
    last_tested timestamp without time zone,
    test_result character varying(20),
    app_id text,
    disable_thought_chain boolean DEFAULT false,
    enable_advanced_params boolean DEFAULT false,
    filter_thought_output boolean DEFAULT false,
    translate_model character varying(100),
    optimize_model character varying(100),
    vlm_model character varying(100),
    show_on_assistant boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    id character varying(50) NOT NULL,
    translate_settings jsonb DEFAULT '{}'::jsonb,
    interface_settings jsonb DEFAULT '{}'::jsonb,
    system_settings jsonb DEFAULT '{}'::jsonb,
    feature_switches jsonb DEFAULT '{}'::jsonb,
    selected_services jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    actor_email character varying(255),
    actor_role character varying(20),
    action character varying(50) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id character varying(100),
    details jsonb DEFAULT '{}'::jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: comfyui_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comfyui_configs (
    id character varying(50) NOT NULL,
    feature_id character varying(50) NOT NULL,
    workflow_id character varying(100),
    workflow_json jsonb,
    node_mapping jsonb,
    default_params jsonb,
    fixed_params jsonb,
    connection_id character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false,
    description text,
    execution_count integer DEFAULT 0,
    last_executed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: comfyui_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comfyui_connections (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    host character varying(255) NOT NULL,
    port integer DEFAULT 8188,
    auth_token text,
    enabled boolean DEFAULT true,
    is_default boolean DEFAULT false,
    priority integer DEFAULT 0,
    timeout integer DEFAULT 120000,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: comfyui_execution_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comfyui_execution_logs (
    id integer NOT NULL,
    workflow_id character varying(50) NOT NULL,
    feature_id character varying(50) NOT NULL,
    prompt_id character varying(100),
    params jsonb NOT NULL,
    status character varying(20) NOT NULL,
    execution_time_ms integer,
    error_message text,
    result jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: comfyui_execution_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comfyui_execution_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comfyui_execution_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comfyui_execution_logs_id_seq OWNED BY public.comfyui_execution_logs.id;


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    work_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE favorites; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.favorites IS '用户收藏表';


--
-- Name: COLUMN favorites.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.favorites.user_id IS '用户ID';


--
-- Name: COLUMN favorites.work_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.favorites.work_id IS '作品ID';


--
-- Name: features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.features (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    category character varying(30) NOT NULL,
    icon character varying(50),
    cost integer DEFAULT 10 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    default_executor character varying(50) DEFAULT 'third-party'::character varying NOT NULL,
    fallback_executors jsonb DEFAULT '[]'::jsonb,
    workflow_id character varying(50),
    loras jsonb DEFAULT '[]'::jsonb,
    default_model character varying(100),
    default_params jsonb DEFAULT '{}'::jsonb,
    sort_order integer DEFAULT 0 NOT NULL,
    display_group character varying(50),
    supports_ai_assistant boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: health_check; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.health_check (
    id integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: health_check_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.health_check_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: health_check_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.health_check_id_seq OWNED BY public.health_check.id;


--
-- Name: loras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    trigger_words text[] DEFAULT '{}'::text[] NOT NULL,
    file_path character varying(500) NOT NULL,
    file_hash character varying(64),
    file_size bigint,
    base_model character varying(100),
    scope text[] DEFAULT '{}'::text[] NOT NULL,
    preview_image character varying(500),
    enabled boolean DEFAULT true NOT NULL,
    uploaded_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE loras; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.loras IS 'LoRA 元数据 - 品牌专属模型管理';


--
-- Name: COLUMN loras.trigger_words; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.loras.trigger_words IS '触发词列表，拼接在用户 prompt 前';


--
-- Name: COLUMN loras.file_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.loras.file_path IS 'LoRA 文件路径（指向 ComfyUI models/loras/）';


--
-- Name: COLUMN loras.scope; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.loras.scope IS '适用 AI 服务范围（text2img/refine/...）';


--
-- Name: power_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.power_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    amount integer NOT NULL,
    balance integer NOT NULL,
    reason character varying(255),
    related_id character varying(100),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: power_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.power_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_email character varying(255),
    user_nickname character varying(100),
    type character varying(20) NOT NULL,
    amount integer NOT NULL,
    balance_before integer NOT NULL,
    balance_after integer NOT NULL,
    reason text,
    operator_id uuid,
    operator_email character varying(255),
    related_id character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE power_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.power_transactions IS '算力流水表 - 充值/消耗/扣除/退款/奖励';


--
-- Name: COLUMN power_transactions.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.power_transactions.type IS '交易类型: recharge|consume|deduct|refund|bonus';


--
-- Name: COLUMN power_transactions.amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.power_transactions.amount IS '变动金额，正数=增加，负数=减少';


--
-- Name: COLUMN power_transactions.balance_before; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.power_transactions.balance_before IS '变动前余额';


--
-- Name: COLUMN power_transactions.balance_after; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.power_transactions.balance_after IS '变动后余额';


--
-- Name: COLUMN power_transactions.operator_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.power_transactions.operator_id IS '管理员操作时记录操作人ID';


--
-- Name: prompt_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prompt_rules (
    id character varying(50) NOT NULL,
    category character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    system_prompt text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(255) NOT NULL,
    user_agent text,
    ip_address character varying(45),
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    input jsonb NOT NULL,
    output jsonb,
    error text,
    progress integer DEFAULT 0,
    power_cost integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    feature_code character varying(50),
    executor character varying(50),
    retry_count integer DEFAULT 0 NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    cancelled_at timestamp without time zone
);


--
-- Name: translate_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translate_settings (
    id character varying(50) NOT NULL,
    preserve_newline boolean DEFAULT true,
    remove_redundant_dots boolean DEFAULT false,
    remove_extra_spaces boolean DEFAULT false,
    halfwidth_punctuation boolean DEFAULT false,
    mixed_lang_rule character varying(20) DEFAULT 'to_en'::character varying,
    cache_mixed_lang boolean DEFAULT false,
    use_cache boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    nickname character varying(100),
    avatar text,
    role character varying(20) DEFAULT 'user'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    power integer DEFAULT 100 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    last_login_at timestamp without time zone
);


--
-- Name: workflow_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    service_type character varying(30) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    workflow_json jsonb NOT NULL,
    input_schema jsonb,
    comfyui_version character varying(20),
    required_custom_nodes text[] DEFAULT '{}'::text[],
    enabled boolean DEFAULT true NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE workflow_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workflow_templates IS '工作流模板 - 标准化的工作流 JSON（含 LoRA 节点）';


--
-- Name: COLUMN workflow_templates.service_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_templates.service_type IS '适用 AI 服务（text2img/refine/...）';


--
-- Name: COLUMN workflow_templates.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_templates.version IS '版本号，每次更新递增';


--
-- Name: workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflows (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    workflow_json jsonb NOT NULL,
    comfyui_host character varying(255),
    enabled boolean DEFAULT true NOT NULL,
    last_executed timestamp without time zone,
    execution_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: works; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.works (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255),
    type character varying(50) NOT NULL,
    prompt text,
    input_image_url text,
    output_image_url text,
    output_video_url text,
    output_model_url text,
    params jsonb DEFAULT '{}'::jsonb,
    power_cost integer DEFAULT 0,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    feature_code character varying(50)
);


--
-- Name: comfyui_execution_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comfyui_execution_logs ALTER COLUMN id SET DEFAULT nextval('public.comfyui_execution_logs_id_seq'::regclass);


--
-- Name: health_check id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_check ALTER COLUMN id SET DEFAULT nextval('public.health_check_id_seq'::regclass);


--
-- Data for Name: api_configs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.api_configs (id, name, api_key, provider, model, url, method, enabled, timeout, headers, param_mapping, response_mapping, fallback, description, last_tested, test_result, app_id, disable_thought_chain, enable_advanced_params, filter_thought_output, translate_model, optimize_model, vlm_model, show_on_assistant, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_settings (id, translate_settings, interface_settings, system_settings, feature_switches, selected_services, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, actor_id, actor_email, actor_role, action, resource_type, resource_id, details, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: comfyui_configs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comfyui_configs (id, feature_id, workflow_id, workflow_json, node_mapping, default_params, fixed_params, connection_id, enabled, is_default, description, execution_count, last_executed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: comfyui_connections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comfyui_connections (id, name, host, port, auth_token, enabled, is_default, priority, timeout, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: comfyui_execution_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comfyui_execution_logs (id, workflow_id, feature_id, prompt_id, params, status, execution_time_ms, error_message, result, created_at) FROM stdin;
\.


--
-- Data for Name: favorites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.favorites (id, user_id, work_id, created_at) FROM stdin;
\.


--
-- Data for Name: features; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.features (id, name, description, category, icon, cost, enabled, default_executor, fallback_executors, workflow_id, loras, default_model, default_params, sort_order, display_group, supports_ai_assistant, created_at, updated_at, updated_by) FROM stdin;
text2img	文案生图	文案生图功能	image	Image	10	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	1	灵感与创作	f	2026-08-03 11:46:21.118685	2026-08-03 11:46:21.118685	\N
refine	产品精修	产品精修功能	image	Sparkles	15	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	2	灵感与创作	f	2026-08-03 11:46:21.12406	2026-08-03 11:46:21.12406	\N
relief	图转浮雕图	图转浮雕图功能	3d	Mountain	20	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	3	浮雕圆雕	f	2026-08-03 11:46:21.125032	2026-08-03 11:46:21.125032	\N
image3d	图转3D模型	图转3D模型功能	3d	Box	30	t	third-party	["mock"]	\N	[]	\N	{}	4	浮雕圆雕	f	2026-08-03 11:46:21.125877	2026-08-03 11:46:21.125877	\N
blend	多图融合	多图融合功能	image	Blend	15	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	6	灵感与创作	f	2026-08-03 11:46:21.127546	2026-08-03 11:46:21.127546	\N
oneclick	一键设计	一键设计功能	image	Wand2	15	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	7	灵感与创作	f	2026-08-03 11:46:21.128359	2026-08-03 11:46:21.128359	\N
multiview	生成多视图	生成多视图功能	image	Grid3X3	20	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	8	灵感与创作	f	2026-08-03 11:46:21.12918	2026-08-03 11:46:21.12918	\N
sketch	线稿/写实	线稿/写实功能	image	PenTool	15	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	9	灵感与创作	f	2026-08-03 11:46:21.129947	2026-08-03 11:46:21.129947	\N
free	自由创作区	自由创作区功能	image	Palette	15	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	10	灵感与创作	f	2026-08-03 11:46:21.13079	2026-08-03 11:46:21.13079	\N
text2video	文生视频	文生视频功能	video	Video	50	t	third-party	["mock"]	\N	[]	\N	{}	11	生成视频	f	2026-08-03 11:46:21.131623	2026-08-03 11:46:21.131623	\N
img2video	图生视频	图生视频功能	video	Film	40	t	third-party	["mock"]	\N	[]	\N	{}	12	生成视频	f	2026-08-03 11:46:21.132429	2026-08-03 11:46:21.132429	\N
removebg	移除背景	移除背景功能	image	Eraser	5	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	13	实用工具	f	2026-08-03 11:46:21.133193	2026-08-03 11:46:21.133193	\N
upscale	高清放大	高清放大功能	image	Maximize2	5	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	14	实用工具	f	2026-08-03 11:46:21.133924	2026-08-03 11:46:21.133924	\N
watermark	去除水印	去除水印功能	image	Droplet	5	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	15	实用工具	f	2026-08-03 11:46:21.134669	2026-08-03 11:46:21.134669	\N
dialogue	AI对话	AI对话功能	chat	MessageSquare	2	t	third-party	["mock"]	\N	[]	\N	{}	16	灵感与创作	t	2026-08-03 11:46:21.135432	2026-08-03 11:46:21.135432	\N
tryon	佩戴效果	佩戴效果功能	image	Shirt	25	t	third-party	["mock"]	\N	[]	\N	{}	17	实用工具	f	2026-08-03 11:46:21.136152	2026-08-03 11:46:21.136152	\N
2dto3d	平面转雕塑	平面转立体功能	3d	Layers	25	t	third-party	["comfyui", "mock"]	\N	[]	\N	{}	5	浮雕圆雕	f	2026-08-03 11:46:21.126709	2026-08-03 11:46:21.126709	\N
\.


--
-- Data for Name: health_check; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.health_check (id, updated_at) FROM stdin;
\.


--
-- Data for Name: loras; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loras (id, name, description, trigger_words, file_path, file_hash, file_size, base_model, scope, preview_image, enabled, uploaded_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: power_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.power_logs (id, user_id, type, amount, balance, reason, related_id, created_at) FROM stdin;
11472f00-3a9a-4faa-bb99-05e7a4e5a4b8	69ef6687-ed6a-4f00-9bdd-fc92525b0404	deduct	-15	99984	AI服务: text2img	\N	2026-07-20 07:13:22.626477
9038799e-39e3-4c6a-bcef-dbbbbb57361b	69ef6687-ed6a-4f00-9bdd-fc92525b0404	deduct	-2	99982	AI对话	\N	2026-07-31 13:15:40.214266
\.


--
-- Data for Name: power_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.power_transactions (id, user_id, user_email, user_nickname, type, amount, balance_before, balance_after, reason, operator_id, operator_email, related_id, created_at) FROM stdin;
\.


--
-- Data for Name: prompt_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.prompt_rules (id, category, name, system_prompt, enabled, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, token, user_agent, ip_address, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (key, value, description, updated_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tasks (id, user_id, type, status, input, output, error, progress, power_cost, created_at, started_at, completed_at, feature_code, executor, retry_count, max_retries, cancelled_at) FROM stdin;
\.


--
-- Data for Name: translate_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.translate_settings (id, preserve_newline, remove_redundant_dots, remove_extra_spaces, halfwidth_punctuation, mixed_lang_rule, cache_mixed_lang, use_cache, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, nickname, avatar, role, status, power, created_at, updated_at, last_login_at) FROM stdin;
69ef6687-ed6a-4f00-9bdd-fc92525b0404	admin@dunhuang.com	$2b$12$RO6MpwpcE7QMA51ZuGi2MO3dtExJk/qTOHHVLpcS9J0Ep50hvEEs6	超级管理员	\N	admin	active	99982	2026-07-20 07:10:07.404631	2026-07-31 13:15:40.25	\N
b74b7a00-ae62-4973-8afe-c97b80fca3cf	e2e-test-1785755071940@test.com	$2b$12$sWJl3HB0X9IuAlTmqupDF.EdXvR2iquGHs60rDwjQnZwNffc0JV8G	E2E Test User	\N	user	active	100	2026-08-03 11:04:32.51551	2026-08-03 11:04:32.51551	\N
ecccae27-f1b4-4ba5-a847-82c26b653a82	login-test-1785755071941@test.com	$2b$12$Y5EkMQVE55dBDDCmh5nSMe7UcPaRpuE6Y5.JNhtAjrC1Zz0U6Jjnu	LoginTest	\N	user	active	100	2026-08-03 11:04:32.83836	2026-08-03 11:04:32.83836	\N
179aea43-39df-4193-a943-cb4521692071	authtest-1785755073764@test.com	$2b$12$NYNL64rsrq4x3LS4yJmsh.k5H3xK0xNJ4iWOk0.nu/jQIMHZGNQEi	AuthTest	\N	user	active	100	2026-08-03 11:04:33.982604	2026-08-03 11:04:33.982604	\N
e1179f7b-9bbb-4ac7-b662-034bdb83571d	ratelimit-test-1785755074324@test.com	$2b$12$Uxq.stx87B7HHERHBUETAOcIHykvj17LAaPEwpNP4CKUgpiqwXCHu	RateTest	\N	user	active	100	2026-08-03 11:04:34.537961	2026-08-03 11:04:34.537961	\N
a34cc7c0-38c8-4308-95cd-e2cf4c71d6e9	e2e-test-1785755082853@test.com	$2b$12$QKLA.qG.kBAE9M4e2u1bqemd/XcClOnAF5BAeRcie9Htg8Tfpxpmi	E2E Test User	\N	user	active	100	2026-08-03 11:04:43.156416	2026-08-03 11:04:43.156416	\N
3377d0ef-5433-4906-8c77-f904f576d4dc	login-test-1785755082853@test.com	$2b$12$SkauebRrNMn1kOVLJiCnzuA/rR4rx1oxHlociYz73SgftixTVplrG	LoginTest	\N	user	active	100	2026-08-03 11:04:43.50892	2026-08-03 11:04:43.50892	\N
93c37b7e-7b4f-4ed6-8a7d-c08a0ac0e787	authtest-1785755084122@test.com	$2b$12$JvJ2z8HcjSDo1VvxbtNHBOfqoHSuNWK.WNMwmJ/DddxEVgRzliOfW	AuthTest	\N	user	active	100	2026-08-03 11:04:44.353869	2026-08-03 11:04:44.353869	\N
\.


--
-- Data for Name: workflow_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflow_templates (id, name, service_type, version, workflow_json, input_schema, comfyui_version, required_custom_nodes, enabled, description, created_at, updated_at) FROM stdin;
6347fcea-f6db-4c48-a227-ee97e5c28bbd	text2img-z-turbo	text2img	1	{"1": {"inputs": {"ckpt_name": "z-turbo.safetensors"}, "class_type": "CheckpointLoaderSimple"}, "2": {"inputs": {"clip": ["1", 1], "text": "{{prompt}}"}, "class_type": "CLIPTextEncode"}, "3": {"inputs": {"clip": ["1", 1], "text": "{{negative_prompt}}"}, "class_type": "CLIPTextEncode"}, "4": {"inputs": {"width": "{{width}}", "height": "{{height}}", "batch_size": "{{count}}"}, "class_type": "EmptyLatentImage"}, "5": {"inputs": {"cfg": 7, "seed": "{{seed}}", "model": ["1", 0], "steps": 20, "denoise": 1, "negative": ["3", 0], "positive": ["2", 0], "scheduler": "normal", "latent_image": ["4", 0], "sampler_name": "euler"}, "class_type": "KSampler"}, "6": {"inputs": {"vae": ["1", 2], "samples": ["5", 0]}, "class_type": "VAEDecode"}, "7": {"inputs": {"images": ["6", 0], "filename_prefix": "dunhuang_text2img"}, "class_type": "SaveImage"}}	\N	latest	{}	t	标准文生图工作流（Z-Turbo）	2026-08-03 11:24:04.334415	2026-08-03 11:24:04.334415
ced6c655-5071-4073-83f3-e308c5f0890f	refine-img2img	refine	1	{"1": {"inputs": {"ckpt_name": "z-turbo.safetensors"}, "class_type": "CheckpointLoaderSimple"}, "2": {"inputs": {"image": "{{input_image}}"}, "class_type": "LoadImage"}, "3": {"inputs": {"clip": ["1", 1], "text": "{{prompt}}"}, "class_type": "CLIPTextEncode"}, "4": {"inputs": {"clip": ["1", 1], "text": "{{negative_prompt}}"}, "class_type": "CLIPTextEncode"}, "5": {"inputs": {"vae": ["1", 2], "pixels": ["2", 0]}, "class_type": "VAEEncode"}, "6": {"inputs": {"cfg": 7, "seed": "{{seed}}", "model": ["1", 0], "steps": 20, "denoise": "{{denoise}}", "negative": ["4", 0], "positive": ["3", 0], "scheduler": "normal", "latent_image": ["5", 0], "sampler_name": "euler"}, "class_type": "KSampler"}, "7": {"inputs": {"vae": ["1", 2], "samples": ["6", 0]}, "class_type": "VAEDecode"}, "8": {"inputs": {"images": ["7", 0], "filename_prefix": "dunhuang_img2img"}, "class_type": "SaveImage"}}	\N	latest	{}	t	产品精修 - 图生图工作流	2026-08-03 11:24:04.339587	2026-08-03 11:24:04.339587
48fdd508-8e40-4cc3-834d-4ec661ad4cc3	lora-brand-style	text2img	1	{"1": {"inputs": {"ckpt_name": "{{base_model}}"}, "class_type": "CheckpointLoaderSimple"}, "2": {"inputs": {"clip": ["1", 1], "model": ["1", 0], "lora_name": "{{lora_name}}", "strength_clip": "{{lora_strength}}", "strength_model": "{{lora_strength}}"}, "class_type": "LoRALoader"}, "3": {"inputs": {"clip": ["2", 1], "text": "{{prompt}}"}, "class_type": "CLIPTextEncode"}, "4": {"inputs": {"clip": ["2", 1], "text": "{{negative_prompt}}"}, "class_type": "CLIPTextEncode"}, "5": {"inputs": {"width": "{{width}}", "height": "{{height}}", "batch_size": "{{count}}"}, "class_type": "EmptyLatentImage"}, "6": {"inputs": {"cfg": 6.5, "seed": "{{seed}}", "model": ["2", 0], "steps": 25, "denoise": 1, "negative": ["4", 0], "positive": ["3", 0], "scheduler": "normal", "latent_image": ["5", 0], "sampler_name": "euler_ancestral"}, "class_type": "KSampler"}, "7": {"inputs": {"vae": ["1", 2], "samples": ["6", 0]}, "class_type": "VAEDecode"}, "8": {"inputs": {"images": ["7", 0], "filename_prefix": "dunhuang_lora"}, "class_type": "SaveImage"}}	\N	latest	{}	t	品牌 LoRA 挂载工作流	2026-08-03 11:24:04.341666	2026-08-03 11:24:04.341666
\.


--
-- Data for Name: workflows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflows (id, name, description, workflow_json, comfyui_host, enabled, last_executed, execution_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: works; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.works (id, user_id, title, type, prompt, input_image_url, output_image_url, output_video_url, output_model_url, params, power_cost, status, is_public, created_at, feature_code) FROM stdin;
79f9970b-1e0a-47d7-9a68-cfe6942ce64f	69ef6687-ed6a-4f00-9bdd-fc92525b0404	文生图-1784531602650	text2img	????,????,??????	\N	/api/comfyui-image?filename=ZTurbo_00057_.png&subfolder=%E6%95%A6%E7%85%8C%E9%87%91	\N	\N	{}	0	completed	f	2026-07-20 07:13:22.618185	\N
\.


--
-- Name: comfyui_execution_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.comfyui_execution_logs_id_seq', 1, false);


--
-- Name: health_check_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.health_check_id_seq', 1, false);


--
-- Name: api_configs api_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_configs
    ADD CONSTRAINT api_configs_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: comfyui_configs comfyui_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comfyui_configs
    ADD CONSTRAINT comfyui_configs_pkey PRIMARY KEY (id);


--
-- Name: comfyui_connections comfyui_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comfyui_connections
    ADD CONSTRAINT comfyui_connections_pkey PRIMARY KEY (id);


--
-- Name: comfyui_execution_logs comfyui_execution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comfyui_execution_logs
    ADD CONSTRAINT comfyui_execution_logs_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: features features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.features
    ADD CONSTRAINT features_pkey PRIMARY KEY (id);


--
-- Name: loras loras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loras
    ADD CONSTRAINT loras_pkey PRIMARY KEY (id);


--
-- Name: power_logs power_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.power_logs
    ADD CONSTRAINT power_logs_pkey PRIMARY KEY (id);


--
-- Name: power_transactions power_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.power_transactions
    ADD CONSTRAINT power_transactions_pkey PRIMARY KEY (id);


--
-- Name: prompt_rules prompt_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_rules
    ADD CONSTRAINT prompt_rules_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_unique UNIQUE (token);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: translate_settings translate_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translate_settings
    ADD CONSTRAINT translate_settings_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workflow_templates workflow_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_name_key UNIQUE (name);


--
-- Name: workflow_templates workflow_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: works works_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.works
    ADD CONSTRAINT works_pkey PRIMARY KEY (id);


--
-- Name: audit_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_actor_idx ON public.audit_logs USING btree (actor_id, created_at);


--
-- Name: audit_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_resource_idx ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_favorites_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_user_id ON public.favorites USING btree (user_id);


--
-- Name: idx_favorites_work_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_work_id ON public.favorites USING btree (work_id);


--
-- Name: idx_loras_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loras_enabled ON public.loras USING btree (enabled) WHERE (enabled = true);


--
-- Name: idx_loras_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loras_scope ON public.loras USING gin (scope);


--
-- Name: idx_pt_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_created_at ON public.power_transactions USING btree (created_at DESC);


--
-- Name: idx_pt_operator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_operator_id ON public.power_transactions USING btree (operator_id);


--
-- Name: idx_pt_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_type ON public.power_transactions USING btree (type);


--
-- Name: idx_pt_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_user_id ON public.power_transactions USING btree (user_id);


--
-- Name: idx_tasks_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_created_at ON public.tasks USING btree (created_at);


--
-- Name: idx_tasks_feature_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_feature_code ON public.tasks USING btree (feature_code);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);


--
-- Name: idx_workflow_templates_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_templates_service ON public.workflow_templates USING btree (service_type, enabled) WHERE (enabled = true);


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: favorites favorites_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_work_id_works_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_work_id_works_id_fk FOREIGN KEY (work_id) REFERENCES public.works(id) ON DELETE CASCADE;


--
-- Name: features features_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.features
    ADD CONSTRAINT features_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: loras loras_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loras
    ADD CONSTRAINT loras_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: power_logs power_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.power_logs
    ADD CONSTRAINT power_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: power_transactions power_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.power_transactions
    ADD CONSTRAINT power_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: works works_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.works
    ADD CONSTRAINT works_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict vM5HAoePyYdDJxf8ocn1gsTankDLnl2FOQUWpW0pv2wI4Hbd49LbhyEzHBojiSZ

