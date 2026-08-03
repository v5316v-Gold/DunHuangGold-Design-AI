import { describe, it, expect } from 'vitest';
import {
  isError,
  getErrorMessage,
  isDatabaseError,
  isApiError,
  createErrorResponse,
  createLogger,
} from '../lib/error-handler';

describe('Error Handler Utils', () => {
  describe('isError', () => {
    it('should return true for Error instances', () => {
      const error = new Error('Test error');
      expect(isError(error)).toBe(true);
    });

    it('should return false for non-Error values', () => {
      expect(isError('string')).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
      expect(isError(123)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return message from Error instance', () => {
      const error = new Error('Test message');
      expect(getErrorMessage(error)).toBe('Test message');
    });

    it('should convert non-Error to string', () => {
      expect(getErrorMessage('string error')).toBe('string error');
      expect(getErrorMessage(123)).toBe('123');
      expect(getErrorMessage(null)).toBe('null');
    });
  });

  describe('isDatabaseError', () => {
    it('should return true for database errors', () => {
      const error = new Error('Database error') as Error & { code?: string };
      error.code = '23505';
      expect(isDatabaseError(error)).toBe(true);
    });

    it('should return false for non-database errors', () => {
      expect(isDatabaseError(new Error('Regular error'))).toBe(false);
      expect(isDatabaseError('string')).toBe(false);
    });
  });

  describe('isApiError', () => {
    it('should return true for API errors', () => {
      const error = new Error('API error') as Error & { status?: number };
      error.status = 404;
      expect(isApiError(error)).toBe(true);
    });

    it('should return false for non-API errors', () => {
      expect(isApiError(new Error('Regular error'))).toBe(false);
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response from Error', () => {
      const error = new Error('Test error');
      const response = createErrorResponse(error, 'test context');

      expect(response).toMatchObject({
        success: false,
        error: 'Test error',
        context: 'test context',
      });
    });

    it('should include stack in development mode', () => {
      const error = new Error('Test error');
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = createErrorResponse(error);
      expect(response.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Logger', () => {
    it('should create logger with context', () => {
      const logger = createLogger('test');
      expect(logger).toBeDefined();
    });

    it('should log info message', () => {
      const logger = createLogger('test');
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('Test info');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log error with error object', () => {
      const logger = createLogger('test');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      logger.error('Test error', error);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
