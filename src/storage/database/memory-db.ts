/**
 * 内存数据库回退方案
 * 当 PostgreSQL 不可用时，使用内存存储
 * 
 * 注意：此文件使用 camelCase 列名，与 src/db/schema/_tables.ts 保持一致
 */

import { comfyuiConfigs, comfyuiConnections } from './shared/schema';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Sprint 1 P0-3 · 生产环境禁用内存回退
// 安全理由：本文件硬编码默认 admin 账号，若 production 下 DB 不可用会 fallback 到此，
// 导致任何人可用默认密码登录 → 严重安全隐患。
// 决策：production 下内存回退不初始化默认账号，users 为空，拒绝登录。
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// 内存存储
interface MemoryStore {
  users: Array<{
    id: string;
    email: string;
    nickname: string;
    passwordHash: string;
    role: string;
    power: number;
    avatar?: string;
    createdAt: Date;
  }>;
  comfyuiConnections: Array<{
    id: string;
    name: string;
    host: string;
    port: number;
    authToken?: string;
    enabled: boolean;
    isDefault: boolean;
    priority: number;
    timeout: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  comfyuiConfigs: Array<{
    id: string;
    featureId: string;
    workflowId: string;
    workflowJson: any;
    nodeMapping: any;
    defaultParams: any;
    fixedParams: any;
    connectionId: string;
    enabled: boolean;
    isDefault: boolean;
    description?: string;
    executionCount: number;
    lastExecutedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

const store: MemoryStore = {
  users: IS_PRODUCTION ? [] : [{
    id: 'admin-default',
    email: 'admin@dunhuang.com',
    nickname: '管理员',
    passwordHash: '$2b$10$zYYqAxQnedGk67d/3LadZuRgk5bYVhDD77ROp/Z5HWv9H6eoxZqoi', // admin123（仅 dev/test）
    role: 'admin',
    power: 999999,
    createdAt: new Date(),
  }],
  comfyuiConnections: [],
  comfyuiConfigs: [],
};

// 初始化默认数据
function initDefaults() {
  if (store.comfyuiConnections.length === 0) {
    store.comfyuiConnections.push({
      id: 'default',
      name: '本地 ComfyUI',
      host: '127.0.0.1',
      port: 8188,
      enabled: true,
      isDefault: true,
      priority: 0,
      timeout: 120000,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (store.comfyuiConfigs.length === 0) {
    const features = [
      { id: 'text2img', name: '文案生图' },
      { id: 'refine', name: '产品精修' },
      { id: 'removebg', name: '移除背景' },
      { id: 'upscale', name: '高清放大' },
      { id: 'sketch', name: '线稿/写实' },
      { id: 'relief', name: '浮雕效果' },
      { id: 'blend', name: '多图融合' },
      { id: 'watermark', name: '去除水印' },
      { id: 'multi-view', name: '生成多视图' },
      { id: 'image-3d', name: '3D模型生成' },
    ];

    features.forEach(f => {
      store.comfyuiConfigs.push({
        id: f.id,
        featureId: f.id,
        workflowId: '',
        workflowJson: {},
        nodeMapping: {},
        defaultParams: { width: 512, height: 512, steps: 20, cfg: 7.0 },
        fixedParams: {},
        connectionId: 'default',
        enabled: false,
        isDefault: false,
        description: f.name,
        executionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  }
}

initDefaults();

// CRUD 操作
export const memoryDb = {
  // 用户操作
  users: {
    findByEmail: async (email: string) => {
      return store.users.find(u => u.email === email) || null;
    },
    findById: async (id: string) => {
      return store.users.find(u => u.id === id) || null;
    },
  },

  // 连接操作
  connections: {
    findMany: async (): Promise<any[]> => {
      return store.comfyuiConnections.map(c => ({ ...c }));
    },

    findFirst: async (id: string): Promise<any | null> => {
      return store.comfyuiConnections.find(c => c.id === id) || null;
    },

    upsert: async (data: any): Promise<any> => {
      const existing = store.comfyuiConnections.findIndex(c => c.id === data.id);
      const now = new Date();
      
      const record = {
        ...data,
        updatedAt: now,
        createdAt: existing >= 0 ? store.comfyuiConnections[existing].createdAt : now,
      };

      if (existing >= 0) {
        store.comfyuiConnections[existing] = record;
      } else {
        store.comfyuiConnections.push(record);
      }
      
      return record;
    },

    delete: async (id: string): Promise<boolean> => {
      const idx = store.comfyuiConnections.findIndex(c => c.id === id);
      if (idx >= 0) {
        store.comfyuiConnections.splice(idx, 1);
        return true;
      }
      return false;
    },
  },

  // 配置操作
  configs: {
    findMany: async (): Promise<any[]> => {
      return store.comfyuiConfigs.map(c => ({ ...c }));
    },

    findFirst: async (featureId: string): Promise<any | null> => {
      return store.comfyuiConfigs.find(c => c.featureId === featureId) || null;
    },

    upsert: async (data: any): Promise<any> => {
      const featureId = data.featureId;
      const existing = store.comfyuiConfigs.findIndex(c => c.featureId === featureId);
      const now = new Date();

      const record = {
        id: data.id || data.featureId,
        featureId: featureId,
        workflowId: data.workflowId || '',
        workflowJson: data.workflowJson || {},
        nodeMapping: data.nodeMapping || {},
        defaultParams: data.defaultParams || {},
        fixedParams: data.fixedParams || {},
        connectionId: data.connectionId || '',
        enabled: data.enabled ?? false,
        isDefault: data.isDefault ?? false,
        description: data.description || '',
        executionCount: data.executionCount || 0,
        lastExecutedAt: data.lastExecutedAt || null,
        createdAt: existing >= 0 ? store.comfyuiConfigs[existing].createdAt : now,
        updatedAt: now,
      };

      if (existing >= 0) {
        store.comfyuiConfigs[existing] = record;
      } else {
        store.comfyuiConfigs.push(record);
      }

      return record;
    },

    delete: async (id: string): Promise<boolean> => {
      const idx = store.comfyuiConfigs.findIndex(c => c.id === id);
      if (idx >= 0) {
        store.comfyuiConfigs.splice(idx, 1);
        return true;
      }
      return false;
    },

    incrementExecution: async (featureId: string): Promise<void> => {
      const config = store.comfyuiConfigs.find(c => c.featureId === featureId);
      if (config) {
        config.executionCount = (config.executionCount || 0) + 1;
        config.lastExecutedAt = new Date();
      }
    },
  },
};

export default memoryDb;
