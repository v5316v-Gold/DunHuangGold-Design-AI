import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Phase 9.8 · standalone 输出（镜像瘦身 347MB → ~50MB）
  // 本地压测时 NEXT_OUTPUT='export' 或关闭（避免 Windows symlink EPERM）
  // 镜像构建保留 'standalone'（默认）
  output: (process.env.NEXT_OUTPUT as 'standalone' | 'export' | undefined) || 'standalone',

  // ESLint 检查（构建时也检查）
  eslint: { ignoreDuringBuilds: process.env.NEXT_ESLINT_BYPASS === '1' },

  // TypeScript 检查（构建时也检查）
  typescript: { ignoreBuildErrors: false },

  // 局域网部署：CORS 跨域配置
  async headers() {
    return [
      {
        // 匹配所有路由
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type,Authorization,X-API-Key,X-Requested-With,Accept,Origin',
          },
          {
            key: 'Access-Control-Expose-Headers',
            value: 'Content-Length,X-Request-ID',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
          // 安全响应头
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },

  // 服务器行为配置
  serverExternalPackages: ['bcryptjs', 'pg'],

  // 路由配置
  async redirects() {
    return [
      {
        source: '/admin',
        has: [{ type: 'cookie', key: 'auth-token' }],
        destination: '/admin',
        permanent: false,
      },
    ];
  },

  // Webpack 配置（用于本地 AI 服务调试）
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        // bullmq 6 的可选 peer dep（valkey-glide）：未安装时直接走 ioredis fallback
        '@valkey/valkey-glide': false,
      };
    } else {
      // server build：把 bullmq 的可选 native 客户端标记为外部依赖，避免 webpack 强制打包
      const externals = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean);
      externals.push({
        '@valkey/valkey-glide': 'commonjs @valkey/valkey-glide',
      });
      config.externals = externals;
    }
    return config;
  },
};

export default nextConfig;
