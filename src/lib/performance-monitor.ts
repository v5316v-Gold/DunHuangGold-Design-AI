/**
 * 性能监控工具
 * 用于监控 API 响应时间、内存使用、数据库查询等性能指标
 */


/* eslint-disable @typescript-eslint/no-explicit-any */
// 性能指标接口
export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  tags?: Record<string, string>;
}

// 性能监控器
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 1000;

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // 记录性能指标
  recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);

    // 限制存储的指标数量
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  // 获取所有指标
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // 获取指定名称的指标
  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === name);
  }

  // 获取统计信息
  getStats(name: string) {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) {
      return null;
    }

    const durations = metrics.map(m => m.duration);
    durations.sort((a, b) => a - b);

    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const min = durations[0];
    const max = durations[durations.length - 1];
    const median = durations[Math.floor(durations.length / 2)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    return {
      count: metrics.length,
      avg,
      min,
      max,
      median,
      p95,
      p99,
    };
  }

  // 清除所有指标
  clear() {
    this.metrics = [];
  }

  // 清除指定名称的指标
  clearByName(name: string) {
    this.metrics = this.metrics.filter(m => m.name !== name);
  }
}

// 性能计时器
export class PerformanceTimer {
  private name: string;
  private tags?: Record<string, string>;
  private startTime: number;
  private monitor: PerformanceMonitor;

  constructor(name: string, tags?: Record<string, string>) {
    this.name = name;
    this.tags = tags;
    this.startTime = Date.now();
    this.monitor = PerformanceMonitor.getInstance();
  }

  // 停止计时并记录
  stop() {
    const duration = Date.now() - this.startTime;
    this.monitor.recordMetric({
      name: this.name,
      duration,
      timestamp: this.startTime,
      tags: this.tags,
    });
    return duration;
  }
}

// 便捷函数：开始计时
export function startTimer(name: string, tags?: Record<string, string>): PerformanceTimer {
  return new PerformanceTimer(name, tags);
}

// 性能装饰器
export function measurePerformance(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const metricName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const timer = startTimer(metricName);
      try {
        const result = await originalMethod.apply(this, args);
        timer.stop();
        return result;
      } catch (error) {
        timer.stop();
        throw error;
      }
    };

    return descriptor;
  };
}

// 内存使用监控
export function getMemoryUsage(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

// 获取内存使用率
export function getMemoryUsagePercent(): number {
  const usage = getMemoryUsage();
  const total = usage.heapTotal;
  const used = usage.heapUsed;
  return (used / total) * 100;
}

// 格式化内存大小
export function formatMemorySize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// 性能健康检查
export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical';
  memoryUsage: string;
  memoryPercent: number;
  metricsCount: number;
  slowQueries: number;
}

export function checkPerformanceHealth(thresholds?: {
  memoryWarning?: number;
  memoryCritical?: number;
  slowQueryThreshold?: number;
}): HealthCheckResult {
  const {
    memoryWarning = 80,
    memoryCritical = 90,
    slowQueryThreshold = 5000, // 5秒
  } = thresholds || {};

  const monitor = PerformanceMonitor.getInstance();
  const metrics = monitor.getMetrics();

  // 计算内存使用
  const memoryUsage = getMemoryUsagePercent();
  const memoryStatus = formatMemorySize(getMemoryUsage().heapUsed);

  // 计算慢查询
  const slowQueries = metrics.filter(
    m => m.duration > slowQueryThreshold
  ).length;

  // 确定状态
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';

  if (memoryUsage >= memoryCritical) {
    status = 'critical';
  } else if (memoryUsage >= memoryWarning || slowQueries > 10) {
    status = 'warning';
  }

  return {
    status,
    memoryUsage: memoryStatus,
    memoryPercent: memoryUsage,
    metricsCount: metrics.length,
    slowQueries,
  };
}

// 导出单例
export const performanceMonitor = PerformanceMonitor.getInstance();
