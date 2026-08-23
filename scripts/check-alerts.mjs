#!/usr/bin/env node
/**
 * 敦煌金 AI · 监控告警拉取脚本（O13 骨架）
 *
 * Sentry webhook / Prometheus 集成留待用户配置。脚本展示如何拉取 alerts
 * 并按严重性分类输出，作为告警路由 / 通知系统对接的基础。
 *
 * 用法：
 *   SENTRY_API_TOKEN=... SENTRY_ORG=... SENTRY_PROJECT=... \
 *     node scripts/check-alerts.mjs
 *
 * 输出：JSON 列出 open issues，按 level=fatal/error/warning 排序。
 */
import { writeFileSync } from 'node:fs';

const SENTRY_API = 'https://sentry.io/api/0';
const TOKEN = process.env.SENTRY_API_TOKEN;
const ORG = process.env.SENTRY_ORG;
const PROJECT = process.env.SENTRY_PROJECT;

async function fetchSentryIssues() {
  if (!TOKEN || !ORG || !PROJECT) {
    return null; // 配置缺失
  }
  const url = `${SENTRY_API}/projects/${ORG}/${PROJECT}/issues/?query=is:unresolved&limit=50`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!resp.ok) throw new Error(`Sentry API ${resp.status}`);
  const issues = await resp.json();
  return issues.map(i => ({
    id: i.id,
    title: i.title,
    level: i.level,
    count: i.count,
    lastSeen: i.lastSeen,
    culprit: i.culprit,
    metadata: i.metadata,
  }));
}

async function fetchInternalAlerts() {
  // 项目自带 alerts API（admin/system 页用）
  const resp = await fetch('http://127.0.0.1:5000/api/admin/alerts?sinceHours=24&limit=50')
    .catch(() => null);
  if (!resp || !resp.ok) return null;
  const json = await resp.json();
  return json?.data?.recent || json?.data || [];
}

function groupByLevel(alerts) {
  const groups = { fatal: [], error: [], warning: [], info: [] };
  for (const a of alerts) {
    const lvl = (a.level || 'info').toLowerCase();
    if (groups[lvl]) groups[lvl].push(a);
    else groups.info.push(a);
  }
  return groups;
}

async function main() {
  const sentry = await fetchSentryIssues().catch(e => ({ error: e.message }));
  const internal = await fetchInternalAlerts();
  const all = [...(sentry || []), ...(internal || [])];
  const groups = groupByLevel(all);

  const summary = {
    timestamp: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
    total: all.length,
    fatalError: groups.fatal.length + groups.error.length,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (process.env.OUTPUT_FILE) writeFileSync(process.env.OUTPUT_FILE, JSON.stringify({ summary, alerts: all }, null, 2));
  // fatal/error 退出码 1，可被 cron / monitoring 触发
  process.exit(summary.fatalError > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
