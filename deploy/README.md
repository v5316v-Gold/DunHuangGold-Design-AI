# 敦煌金 AI 设计平台 - 部署指南

## 目录
1. [环境要求](#环境要求)
2. [快速部署](#快速部署)
3. [Docker 部署](#docker-部署)
4. [手动部署](#手动部署)
5. [HTTPS 配置](#https-配置)
6. [性能优化](#性能优化)
7. [故障排除](#故障排除)

---

## 环境要求

### 最低配置
- CPU: 2核
- 内存: 4GB
- 存储: 20GB
- Node.js: 20+
- pnpm: 9.0+

### 推荐配置
- CPU: 4核+
- 内存: 8GB+
- 存储: 50GB+
- PostgreSQL: 15+

---

## 快速部署

### 方式一：一键脚本（推荐）

```bash
# 1. 克隆项目
git clone <项目地址>
cd dunhuang-ai

# 2. 配置环境变量
cp .env.example .env.local
nano .env.local  # 编辑配置

# 3. 运行部署脚本
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

### 方式二：PM2 部署

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 使用 PM2 启动
COZE_PROJECT_ENV=PROD pm2 start ecosystem.config.js

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
```

---

## Docker 部署

### 单容器部署

```bash
# 构建镜像
docker build -t dunhuang-ai .

# 运行容器
docker run -d \
  --name dunhuang-ai \
  -p 5000:5000 \
  --env-file .env.local \
  dunhuang-ai
```

### Docker Compose 部署（推荐）

```bash
# 启动所有服务（包括数据库、Redis）
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

---

## 手动部署

### 1. 安装 Node.js

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 pnpm
npm install -g pnpm
```

### 2. 安装 PostgreSQL（可选）

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# 创建数据库
sudo -u postgres psql
CREATE DATABASE dunhuang_design;
CREATE USER dunhuang WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE dunhuang_design TO dunhuang;
```

### 3. 配置环境变量

```bash
# 复制示例配置
cp .env.example .env.local

# 编辑配置
nano .env.local
```

**必填配置：**
```env
# 数据库
DATABASE_URL=postgresql://dunhuang:your_password@localhost:5432/dunhuang_design

# JWT密钥（生成随机字符串）
JWT_SECRET=your-random-secret-key-at-least-32-chars

# AI服务（至少一个）
ZHIPU_API_KEY=your-zhipu-api-key
```

### 4. 构建和启动

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 启动
COZE_PROJECT_ENV=PROD pnpm start
```

---

## HTTPS 配置

### 使用 Nginx + Let's Encrypt

```bash
# 1. 安装 Nginx 和 Certbot
sudo apt install nginx certbot python3-certbot-nginx

# 2. 复制配置文件
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/dunhuang-ai
sudo ln -s /etc/nginx/sites-available/dunhuang-ai /etc/nginx/sites-enabled/

# 3. 修改配置中的域名
sudo nano /etc/nginx/sites-available/dunhuang-ai

# 4. 获取 SSL 证书
sudo certbot --nginx -d your-domain.com

# 5. 重启 Nginx
sudo systemctl restart nginx
```

### 自签名证书（局域网）

```bash
# 生成自签名证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout deploy/ssl/server.key \
  -out deploy/ssl/server.crt \
  -subj "/CN=localhost"

# 修改 Nginx 配置使用自签名证书
```

---

## 性能优化

### 1. 开启 Redis 缓存

```bash
# 安装 Redis
sudo apt install redis-server

# 配置环境变量
REDIS_URL=redis://localhost:6379
```

### 2. 数据库优化

```sql
-- 增加连接数
ALTER SYSTEM SET max_connections = 200;

-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_images_user_id ON images(user_id);
```

### 3. PM2 集群模式

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'dunhuang-ai',
    script: 'dist/server.js',
    instances: 'max',  // 使用所有 CPU 核心
    exec_mode: 'cluster',
  }]
};
```

---

## 故障排除

### 常见问题

**1. 端口被占用**
```bash
# 查看端口占用
lsof -i :5000

# 杀死进程
kill -9 <PID>
```

**2. 数据库连接失败**
```bash
# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 测试连接
psql -U dunhuang -d dunhuang_design -h localhost
```

**3. 内存不足**
```bash
# 查看内存使用
free -h

# 增加 swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

**4. PM2 进程崩溃**
```bash
# 查看日志
pm2 logs dunhuang-ai

# 查看详细信息
pm2 describe dunhuang-ai

# 重置进程
pm2 reset dunhuang-ai
```

### 日志位置

- 应用日志: `/app/work/logs/bypass/app.log`
- PM2 日志: `~/.pm2/logs/`
- Nginx 日志: `/var/log/nginx/`

---

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建
pnpm build

# 重启服务
pm2 restart dunhuang-ai
```

---

## 备份策略

```bash
# 数据库备份
pg_dump -U dunhuang dunhuang_design > backup_$(date +%Y%m%d).sql

# 恢复
psql -U dunhuang dunhuang_design < backup_20240101.sql
```

---

## 监控告警

### 使用 PM2 Plus（推荐）

```bash
# 连接到 PM2 Plus
pm2 link <secret_key> <public_key>
```

### 使用 Uptime Kuma

```bash
docker run -d --restart=always -p 3001:3001 \
  -v uptime-kuma:/app/data \
  --name uptime-kuma \
  louislam/uptime-kuma:1
```

添加监控地址: `http://your-server:5000`
