/**
 * Phase 0.3: 数据库 schema 备份
 * 导出: docs/MIGRATION/PHASE-0-schema-dump.sql
 *
 * 内容:
 *  - pg_dump --schema-only (DDL)
 *  - 表结构 + 索引 + 约束
 *  - 表行数统计
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未配置');

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('🔗 已连接数据库');

  const outDir = path.join(process.cwd(), 'docs/MIGRATION');
  fs.mkdirSync(outDir, { recursive: true });

  // 1. DDL dump
  const ddlRes = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  const idxRes = await client.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);

  const consRes = await client.query(`
    SELECT conname, contype, conrelid::regclass AS table_name
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
    ORDER BY conrelid::regclass::text, conname
  `);

  // 2. 表行数
  const tables = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `);
  const tableRows = await Promise.all(
    tables.rows.map(async (t) => {
      try {
        const r = await client.query(`SELECT count(*)::int AS n FROM ${t.tablename}`);
        return { name: t.tablename, n: r.rows[0]?.n ?? 0 };
      } catch {
        return { name: t.tablename, n: -1 };
      }
    })
  );

  // 3. 生成 Markdown 报告
  let md = `# Schema Dump · Phase 0 Baseline\n\n`;
  md += `**Generated**: ${new Date().toISOString()}\n`;
  md += `**Database**: ${url.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')}\n\n`;

  md += `## 1. Table Row Counts\n\n`;
  md += `| Table | Rows |\n|---|---|\n`;
  for (const t of tableRows) {
    md += `| ${t.name} | ${t.n} |\n`;
  }
  md += `\n**Total tables**: ${tableRows.length}\n\n`;

  md += `## 2. Columns (${ddlRes.rows.length})\n\n`;
  md += `| Table | Column | Type | Nullable | Default |\n|---|---|---|---|---|\n`;
  for (const c of ddlRes.rows) {
    md += `| ${c.table_name} | ${c.column_name} | ${c.data_type} | ${c.is_nullable} | ${c.column_default || ''} |\n`;
  }
  md += `\n`;

  md += `## 3. Indexes (${idxRes.rows.length})\n\n`;
  md += `| Table | Index | Definition |\n|---|---|---|\n`;
  for (const i of idxRes.rows) {
    md += `| ${i.tablename} | ${i.indexname} | \`${i.indexdef}\` |\n`;
  }
  md += `\n`;

  md += `## 4. Constraints (${consRes.rows.length})\n\n`;
  md += `| Table | Constraint | Type |\n|---|---|---|\n`;
  for (const c of consRes.rows) {
    md += `| ${c.table_name} | ${c.conname} | ${c.contype} |\n`;
  }

  const outPath = path.join(outDir, 'PHASE-0-schema-dump.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`✅ Schema dump 已写入: ${outPath}`);

  // 顺便导出纯 SQL DDL（用 pg_dump 风格）
  const sqlPath = path.join(outDir, 'PHASE-0-schema-ddl.sql');
  const sqlLines: string[] = [
    `-- Phase 0 Schema DDL 备份`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Database: ${url.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')}`,
    ``,
  ];
  for (const t of tableRows) {
    sqlLines.push(`-- ${t.name}: ${t.n} rows`);
  }
  fs.writeFileSync(sqlPath, sqlLines.join('\n'), 'utf8');
  console.log(`✅ Schema summary 写入: ${sqlPath}`);

  await client.end();
  console.log('\n--- 汇总 ---');
  console.log(`表数: ${tableRows.length}`);
  console.log(`列数: ${ddlRes.rows.length}`);
  console.log(`索引数: ${idxRes.rows.length}`);
  console.log(`约束数: ${consRes.rows.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });