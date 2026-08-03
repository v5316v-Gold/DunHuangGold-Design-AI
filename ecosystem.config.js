// PM2 配置文件 - 敦煌金AI设计平台
// 使用方法: pm2 start ecosystem.config.js
//
// 启动后访问地址: http://192.168.2.156:5000 (局域网) 或 http://localhost:5000 (本机)
// 2026-07-20 重构：端口统一为 5000，绑定 0.0.0.0，IP 更新到当前 LAN，DB 账号修正
// 2026-07-30 W1 改造：增加 worker 进程（异步任务消费）

module.exports = {
  apps: [
    // 主 Web 服务（端口 5000）
    {
      name: 'dunhuang-app',
      script: 'C:\\Program Files\\nodejs\\node.exe',
      args: 'node_modules\\.bin\\next start -p 5000 -H 0.0.0.0',
      cwd: 'C:\\Users\\v5316\\.openclaw\\workspace\\image-gen-components',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://dunhuang1:***@localhost:5432/dunhuang',
        REDIS_URL: 'redis://localhost:6379',  // W1 新增
        JWT_SECRET: '90yRTSHtbzfDOGmL5Ikx2aeUKjcdAsq6F7NpguBh4V8XMr3ECiQWYvPJnolwZ1',
        NEXT_PUBLIC_APP_URL: 'http://192.168.2.156:5000',
        ALLOWED_ORIGIN: 'http://192.168.2.156:5000,http://localhost:5000',
        UPLOAD_DIR: '\\\\wsl$\\Ubuntu\\var\\dunhuang\\uploads'
      }
    },
    // Worker 进程（异步任务消费 · W1 新增）
    {
      name: 'dunhuang-worker',
      script: 'C:\\Program Files\\nodejs\\node.exe',
      args: 'node_modules\\.bin\\tsx worker/src/index.ts',
      cwd: 'C:\\Users\\v5316\\.openclaw\\workspace\\image-gen-components',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      // Worker 启动延迟，避免与 Web 进程同时抢资源
      listen_timeout: 10000,
      kill_timeout: 30000,  // 给 Worker 30s 优雅退出
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://dunhuang1:***@localhost:5432/dunhuang',
        REDIS_URL: 'redis://localhost:6379',
        UPLOAD_DIR: '\\\\wsl$\\Ubuntu\\var\\dunhuang\\uploads',
        // 上传文件基础 URL（生成结果图保存到本地后用）
        NEXT_PUBLIC_APP_URL: 'http://192.168.2.156:5000'
      }
    }
  ]
};
