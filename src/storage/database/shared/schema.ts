/**
 * 统一 Schema 转发文件
 * 
 * 所有表定义已迁移至 src/db/schema/_tables.ts
 * 此文件转发到统一 schema，保持 @/storage/database 引用兼容
 */

export * from '@/db/schema/_tables';
