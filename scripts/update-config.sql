-- 更新 AI 助手配置为 OpenClaw 九色鹿模式
INSERT INTO system_settings (key, value, description) 
VALUES ('ai-assistant-config', '{"apiKey":"","provider":"openclaw","model":"MiniMax-M2.7-highspeed"}', '提示词小助手配置') 
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 同时更新 api_configs 表
INSERT INTO api_configs (id, name, api_key, provider, model, enabled) 
VALUES ('llm-chat', 'LLM Chat', '', 'openclaw', 'MiniMax-M2.7-highspeed', true) 
ON CONFLICT (id) DO UPDATE SET provider = EXCLUDED.provider, model = EXCLUDED.model, enabled = EXCLUDED.enabled;
