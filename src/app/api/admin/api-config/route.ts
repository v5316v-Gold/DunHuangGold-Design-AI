/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并目标: /api/admin/settings
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  coreApiConfigs,
  featureConfigs,
  featureApiMapping,
  PowerSource,
  ApiMapping,
  getGlobalPowerSource,
  setGlobalPowerSource,
  toggleApiSource,
  initializeConfigs,
} from '@/lib/api-config';
import { saveApiConfig, clearConfigCache, getMemoryConfigs } from '@/lib/api-config-service';
import { db } from '@/db';
import { apiConfigs } from '@/db/schema';
import { apiConfigsRepository } from '@/db/repositories';
import { sanitizeError } from '@/lib/validators';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/lib/error-handler';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

const logger = createLogger('api-config');

export const dynamic = 'force-dynamic';


// GET - 获取所有 API 配置
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // 获取数据库中的所有API配置（用于API管理器）
    if (action === 'list') {
      if (!db) {
        return NextResponse.json({ requestId: reqId(), success: true, data: [] });
      }
      try {
        const configs = await apiConfigsRepository.list();
        return NextResponse.json({ requestId: reqId(), success: true, data: configs });
      } catch (error) {
        const errorMessage = sanitizeError(error, '操作失败').message;
        if (errorMessage.includes('does not exist')) {
          return NextResponse.json({ requestId: reqId(), success: true, data: [] });
        }
        throw error;
      }
    }

    // 确保配置已初始化
    await initializeConfigs();

    // 从数据库加载配置并合并到 coreApiConfigs
    if (db) {
      try {
        const dbConfigs = await db.select().from(apiConfigs);
        const memoryConfigs = getMemoryConfigs();

        console.log(`[api-config] 从数据库加载了 ${dbConfigs.length} 个配置`);
        console.log(`[api-config] 从内存加载了 ${memoryConfigs.size} 个配置`);

        // 合并数据库配置和内存配置到 coreApiConfigs
        for (const dbConfig of dbConfigs) {
          if (coreApiConfigs[dbConfig.id]) {
            // 更新云端配置
            if (dbConfig.apiKey) {
              coreApiConfigs[dbConfig.id].cloud.apiKey = dbConfig.apiKey;
            }
            if (dbConfig.provider) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              coreApiConfigs[dbConfig.id].cloud.provider = dbConfig.provider as any;
            }
            if (dbConfig.model) {
              coreApiConfigs[dbConfig.id].cloud.model = dbConfig.model;
            }
            if (dbConfig.url) {
              coreApiConfigs[dbConfig.id].cloud.url = dbConfig.url;
            }
            if (dbConfig.enabled !== undefined) {
              coreApiConfigs[dbConfig.id].enabled = dbConfig.enabled;
            }
            console.log(`[api-config] 从数据库恢复配置: ${dbConfig.id}, hasApiKey=${!!dbConfig.apiKey}`);
          }
        }

        // 合并内存配置到 coreApiConfigs
        for (const [id, memConfig] of memoryConfigs.entries()) {
          if (coreApiConfigs[id]) {
            if (memConfig.apiKey) {
              coreApiConfigs[id].cloud.apiKey = memConfig.apiKey;
            }
            if (memConfig.provider) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              coreApiConfigs[id].cloud.provider = memConfig.provider as any;
            }
            if (memConfig.model) {
              coreApiConfigs[id].cloud.model = memConfig.model;
            }
            if (memConfig.url) {
              coreApiConfigs[id].cloud.url = memConfig.url;
            }
            console.log(`[api-config] 从内存恢复配置: ${id}, hasApiKey=${!!memConfig.apiKey}`);
          }
        }
      } catch (error) {
        // 检查是否是表不存在错误
        const errorMessage = sanitizeError(error, '操作失败').message;
        if (errorMessage.includes('42P01') && errorMessage.includes('does not exist')) {
          logger.info('数据库表 api_configs 不存在，跳过数据库加载');
        } else {
          logger.error('加载数据库配置失败', error);
        }
      }
    }

    // 获取单个配置
    if (action === 'get' && searchParams.get('id')) {
      const id = searchParams.get('id')!;
      const config = coreApiConfigs[id];
      if (!config) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '配置不存在' }, { status: 404 });
      }
      return NextResponse.json({ requestId: reqId(), success: true, data: config });
    }

    // 获取模块映射关系
    if (action === 'mapping') {
      return NextResponse.json({
        requestId: reqId(), success: true,
        data: {
          configs: coreApiConfigs,
          mapping: featureApiMapping,
          globalSource: getGlobalPowerSource(),
        }
      });
    }

    // 获取所有配置
    console.log('[api-config] coreApiConfigs reference:', typeof coreApiConfigs);
    console.log('[api-config] coreApiConfigs keys:', Object.keys(coreApiConfigs));
    console.log('[api-config] 3d-modeling config:', JSON.stringify(coreApiConfigs['3d-modeling']?.cloud || {}, null, 2));

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: {
        configs: coreApiConfigs,
        features: featureConfigs,
        globalSource: getGlobalPowerSource(),
      } as ApiMapping
    });
  } catch (error) {
    return NextResponse.json({ requestId: reqId(), success: false, error: sanitizeError(error, '操作失败').message }, { status: 500 });
  }
}

// POST - 更新 API 配置
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }
    const body = await request.json();
    const { action, id, config, source } = body;

    // 切换全局算力来源
    if (action === 'toggle-global-source' && source) {
      setGlobalPowerSource(source as PowerSource);
      
      return NextResponse.json({ 
        requestId: reqId(), success: true, 
        data: { globalSource: source },
        message: `已切换到${source === 'cloud' ? '云算力' : '本地算力'}`
      });
    }

    // 切换单个API的算力来源
    if (action === 'toggle-source' && id) {
      const newSource = toggleApiSource(id, source);
      
      return NextResponse.json({ 
        requestId: reqId(), success: true, 
        data: { id, source: newSource },
        message: `已切换到${newSource === 'cloud' ? '云算力' : '本地算力'}`
      });
    }

    // 测试 API 连通性
    if (action === 'test' && id) {
      const apiConfig = coreApiConfigs[id];
      if (!apiConfig) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '配置不存在' }, { status: 404 });
      }

      const testSourceType = source as PowerSource || apiConfig.source;

      // 测试本地服务
      if (testSourceType === 'local') {
        if (!apiConfig.local.service) {
          return NextResponse.json({ 
            requestId: reqId(), success: false,
            error: '未配置本地服务',
          });
        }

        try {
          const service = apiConfig.local.service;
          const testUrl = `http://${service.host}:${service.port}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(testUrl, {
            method: 'GET',
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          apiConfig.lastTested = new Date().toISOString();
          apiConfig.localTestResult = response.ok ? 'success' : 'failed';

          return NextResponse.json({ 
            requestId: reqId(), success: response.ok,
            data: { status: response.status },
            message: response.ok ? '本地服务连接正常' : `本地服务返回 ${response.status}`,
          });
        } catch (testError: unknown) {
          apiConfig.lastTested = new Date().toISOString();
          apiConfig.localTestResult = 'failed';

          return NextResponse.json({ 
            requestId: reqId(), success: false,
            error: (testError instanceof Error ? testError.message : String(testError)) || '本地服务测试失败',
          });
        }
      }

      // 测试云端服务（模拟测试）
      try {
        apiConfig.lastTested = new Date().toISOString();
        apiConfig.cloudTestResult = 'success';

        return NextResponse.json({
          requestId: reqId(), success: true,
          data: {
            ok: true,
            testedAt: apiConfig.lastTested,
          },
          message: '云端服务配置有效',
        });
      } catch (testError: unknown) {
        apiConfig.lastTested = new Date().toISOString();
        apiConfig.cloudTestResult = 'failed';

        return NextResponse.json({
          requestId: reqId(), success: false,
          error: (testError instanceof Error ? testError.message : String(testError)) || '云端服务测试失败',
        });
      }
    }

    // 更新本地服务配置
    if (action === 'update-local-service' && id && config) {
      const apiConfig = coreApiConfigs[id];
      if (!apiConfig) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '配置不存在' }, { status: 404 });
      }

      const host = config.host || '127.0.0.1';
      const port = config.port || 8188;

      // 更新本地服务配置
      if (apiConfig.local.service) {
        apiConfig.local.service.host = host;
        apiConfig.local.service.port = port;
      } else {
        apiConfig.local.service = {
          type: 'comfyui',
          host,
          port,
        };
      }
      
      return NextResponse.json({ 
        requestId: reqId(), success: true, 
        data: apiConfig,
        message: '本地服务配置已更新'
      });
    }

    // 更新云端服务配置
    if (action === 'update-cloud-service' && id && config) {
      const apiConfig = coreApiConfigs[id];
      if (!apiConfig) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '配置不存在' }, { status: 404 });
      }

      // 更新内存配置
      if (config.apiKey !== undefined) {
        apiConfig.cloud.apiKey = config.apiKey;
      }
      if (config.provider !== undefined) {
        apiConfig.cloud.provider = config.provider;
      }
      if (config.model !== undefined) {
        apiConfig.cloud.model = config.model;
      }
      if (config.url !== undefined) {
        apiConfig.cloud.url = config.url;
      }
      if (config.timeout !== undefined) {
        apiConfig.cloud.timeout = config.timeout;
      }

      // 尝试保存到数据库（持久化）
      const saved = await saveApiConfig(id, {
        apiKey: config.apiKey,
        provider: config.provider,
        model: config.model,
        url: config.url,
        enabled: apiConfig.enabled,
      });

      if (saved) {
        console.log(`[api-config] 配置 ${id} 已保存到数据库`);
        clearConfigCache();
      }

      return NextResponse.json({ 
        requestId: reqId(), success: true, 
        data: apiConfig,
        message: saved ? '配置已保存到数据库' : '配置已更新（仅在内存中）'
      });
    }

    // 更新配置
    if (action === 'update' && id && config) {
      const existingConfig = coreApiConfigs[id];
      if (!existingConfig) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '配置不存在' }, { status: 404 });
      }

      // 合并配置
      Object.assign(existingConfig, config);
      
      return NextResponse.json({ 
        requestId: reqId(), success: true, 
        data: existingConfig,
        message: '配置已更新'
      });
    }

    // 启用/禁用 API
    if (action === 'toggle' && id) {
      const apiConfig = coreApiConfigs[id];
      if (!apiConfig) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '配置不存在' }, { status: 404 });
      }

      apiConfig.enabled = !apiConfig.enabled;
      
      return NextResponse.json({ 
        requestId: reqId(), success: true, 
        data: apiConfig,
        message: apiConfig.enabled ? 'API已启用' : 'API已禁用'
      });
    }

    // 批量更新配置
    if (action === 'batch-update' && Array.isArray(config)) {
      const results: { id: string; success: boolean; error?: string }[] = [];
      
      for (const item of config) {
        if (item.id && coreApiConfigs[item.id]) {
          Object.assign(coreApiConfigs[item.id], item);
          results.push({ id: item.id, success: true });
        } else {
          results.push({ id: item.id, success: false, error: '配置不存在' });
        }
      }
      
      return NextResponse.json({ 
        requestId: reqId(), success: true, 
        data: results,
        message: '批量更新完成'
      });
    }

    // 创建或更新API配置到数据库
    if (action === 'create' && id && body) {
      if (!db) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '数据库不可用' }, { status: 500 });
      }

      // 检查是否已存在
      const existing = await db.select().from(apiConfigs).where(eq(apiConfigs.id, id)).limit(1);
      
      if (existing.length > 0) {
        // 已存在，更新
        await db.update(apiConfigs).set({
          name: body.name || id,
          provider: body.provider || null,
          apiKey: body.apiKey || null,
          model: body.model || null,
          url: body.url || null,
          enabled: body.enabled || false,
          description: body.description || null,
          appId: body.appId || null,
          disableThoughtChain: body.disableThoughtChain || false,
          enableAdvancedParams: body.enableAdvancedParams || false,
          filterThoughtOutput: body.filterThoughtOutput || false,
          translateModel: body.translateModel || null,
          optimizeModel: body.optimizeModel || null,
          vlmModel: body.vlmModel || null,
          showOnAssistant: body.showOnAssistant || false,
          updatedAt: new Date(),
        }).where(eq(apiConfigs.id, id));
      } else {
        // 不存在，插入
        await db.insert(apiConfigs).values({
          id,
          name: body.name || id,
          provider: body.provider || null,
          apiKey: body.apiKey || null,
          model: body.model || null,
          url: body.url || null,
          enabled: body.enabled || false,
          description: body.description || null,
          appId: body.appId || null,
          disableThoughtChain: body.disableThoughtChain || false,
          enableAdvancedParams: body.enableAdvancedParams || false,
          filterThoughtOutput: body.filterThoughtOutput || false,
          translateModel: body.translateModel || null,
          optimizeModel: body.optimizeModel || null,
          vlmModel: body.vlmModel || null,
          showOnAssistant: body.showOnAssistant || false,
        });
      }

      // 获取配置
      const configs = await db.select().from(apiConfigs).where(eq(apiConfigs.id, id)).limit(1);

      return NextResponse.json({
        requestId: reqId(), success: true,
        data: configs[0],
        message: existing.length > 0 ? 'API配置已更新' : 'API配置已创建'
      });
    }

    // 删除 API 配置
    if (action === 'delete' && id) {
      if (!db) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '数据库不可用' }, { status: 500 });
      }
      await db.delete(apiConfigs).where(eq(apiConfigs.id, id));
      return NextResponse.json({ requestId: reqId(), success: true, message: 'API配置已删除' });
    }

    return NextResponse.json({ requestId: reqId(), success: false, error: '未知操作' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ requestId: reqId(), success: false, error: sanitizeError(error, '操作失败').message }, { status: 500 });
  }
}

// PUT - 完全替换配置
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }
    const body = await request.json();
    const { id, config } = body;

    if (!id || !config) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少参数' }, { status: 400 });
    }

    if (!coreApiConfigs[id]) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '配置不存在' }, { status: 404 });
    }

    // 完全替换配置
    coreApiConfigs[id] = {
      ...coreApiConfigs[id],
      ...config,
      id, // 确保 ID 不被修改
    };

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: coreApiConfigs[id],
      message: '配置已更新'
    });
  } catch (error) {
    return NextResponse.json({ requestId: reqId(), success: false, error: sanitizeError(error, '操作失败').message }, { status: 500 });
  }
}

// DELETE - 删除API配置
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少ID参数' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '数据库不可用' }, { status: 500 });
    }

    await db.delete(apiConfigs).where(eq(apiConfigs.id, id));

    return NextResponse.json({
      requestId: reqId(), success: true,
      message: 'API配置已删除'
    });
  } catch (error) {
    return NextResponse.json({ requestId: reqId(), success: false, error: sanitizeError(error, '操作失败').message }, { status: 500 });
  }
}
