/**
 * 错误处理工具函数
 */

// 生成简短 traceId
export function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// 错误类型守卫
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// 获取错误消息
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}

// 获取错误堆栈
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  return undefined;
}

// 数据库错误类型
export interface DatabaseError extends Error {
  code?: string;
  detail?: string;
  schema?: string;
  table?: string;
  column?: string;
  constraint?: string;
}

// 判断是否为数据库错误
export function isDatabaseError(error: unknown): error is DatabaseError {
  if (!isError(error)) return false;
  const dbError = error as DatabaseError;
  return !!(
    dbError.code ||
    dbError.detail ||
    dbError.schema ||
    dbError.table
  );
}

// API 错误类型
export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

// 判断是否为 API 错误
export function isApiError(error: unknown): error is ApiError {
  if (!isError(error)) return false;
  const apiError = error as ApiError;
  return !!apiError.status || !!apiError.code;
}

// 创建标准化错误响应
export function createErrorResponse(error: unknown, context?: string) {
  const message = getErrorMessage(error);

  return {
    success: false,
    error: message,
    context,
    stack: process.env.NODE_ENV === 'development' ? getErrorStack(error) : undefined,
  };
}

// 日志级别
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// 日志记录器
export class Logger {
  private context: string;
  private traceId?: string;

  constructor(context: string, traceId?: string) {
    this.context = context;
    this.traceId = traceId;
  }

  // 设置 traceId
  withTrace(traceId: string): Logger {
    return new Logger(this.context, traceId);
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const logEntry: Record<string, unknown> = {
      timestamp,
      level,
      context: this.context,
      message,
    };

    if (this.traceId) {
      logEntry.traceId = this.traceId;
    }

    // 只有当 data 存在时才添加到日志条目
    if (data !== undefined) {
      logEntry.data = data;
    }

    // 根据日志级别输出
    switch (level) {
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(JSON.stringify(logEntry));
        }
        break;
      case 'info':
        console.info(JSON.stringify(logEntry));
        break;
      case 'warn':
        console.warn(JSON.stringify(logEntry));
        break;
      case 'error':
        console.error(JSON.stringify(logEntry));
        break;
    }
  }

  info(message: string, ...args: unknown[]) {
    // printf-style: args[0] is format string, rest are substitutions
    const data = args.length > 1 ? args : args[0];
    this.log('info', message, data);
  }

  warn(message: string, ...args: unknown[]) {
    const data = args.length > 1 ? args : args[0];
    this.log('warn', message, data);
  }

  error(message: string, ...args: unknown[]) {
    const errorArg = args[0];
    const errorData = errorArg ? {
      message: getErrorMessage(errorArg),
      ...(isDatabaseError(errorArg) && {
        code: (errorArg as DatabaseError).code,
        table: (errorArg as DatabaseError).table,
      }),
      ...(isApiError(errorArg) && {
        status: (errorArg as ApiError).status,
        code: (errorArg as ApiError).code,
      }),
    } : undefined;

    this.log('error', message, errorData);
  }

  debug(message: string, ...args: unknown[]) {
    const data = args.length > 1 ? args : args[0];
    this.log('debug', message, data);
  }
}

// 创建日志记录器
export function createLogger(context: string): Logger {
  return new Logger(context);
}
