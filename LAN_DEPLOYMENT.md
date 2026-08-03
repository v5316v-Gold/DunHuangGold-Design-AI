# 局域网部署指南

## 一、快速部署清单

### 1. 硬件要求
- CPU: 4核及以上
- 内存: 8GB+（使用本地AI服务建议16GB+）
- 存储: 50GB+

### 2. 软件要求
- Node.js 20+
- pnpm 9+
- PostgreSQL 12+（或使用Supabase）
- 可选: ComfyUI / Ollama（本地AI服务）

## 二、部署步骤

### 步骤1: 获取项目代码

```bash
# 克隆或复制项目到服务器
cd /path/to/project
```

### 步骤2: 配置环境变量

创建 `.env` 文件：

```bash
# 复制示例文件
cp .env.example .env

# 编辑配置
nano .env
```

**必需配置**：

```env
# 数据库（二选一）
DATABASE_URL=postgresql://postgres:password@localhost:5432/dunhuang_design

# JWT密钥（必须修改！）
JWT_SECRET=your-very-long-random-secret-key-at-least-32-chars

# 应用域名（局域网IP）
NEXT_PUBLIC_APP_URL=http://192.168.1.100:5000
```

**可选配置**：

```env
# AI服务（使用云端API）
COZE_API_TOKEN=pat-xxx...

# 对象存储（文件上传）
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=dunhuang-design
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
```

### 步骤3: 安装依赖

```bash
pnpm install
```

### 步骤4: 数据库初始化

```bash
# 创建数据库
createdb dunhuang_design

# 或使用 psql
psql -U postgres -c "CREATE DATABASE dunhuang_design;"

# 执行迁移
pnpm db:push

# 填充初始数据（管理员账户等）
pnpm db:seed
```

### 步骤5: 构建与启动

```bash
# 构建生产版本
coze build

# 启动服务
coze start
```

### 步骤6: 验证部署

```bash
# 本机测试
curl http://localhost:5000

# 查看IP地址
hostname -I | awk '{print $1}'

# 局域网测试（在另一台机器上）
curl http://192.168.1.100:5000
```

## 三、数据库配置

### 选项A: 本地 PostgreSQL

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 创建用户和数据库
sudo -u postgres psql
CREATE USER dunhuang WITH PASSWORD 'your-password';
CREATE DATABASE dunhuang_design OWNER dunhuang;
GRANT ALL PRIVILEGES ON DATABASE dunhuang_design TO dunhuang;
\q
```

### 选项B: Supabase（云端）

1. 访问 [supabase.com](https://supabase.com) 创建项目
2. 获取数据库连接串: Settings > Database > Connection string
3. 配置环境变量:

```env
SUPABASE_DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres
```

## 四、本地AI服务配置（可选）

### ComfyUI（图片生成）

```bash
# 安装 ComfyUI
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
pip install -r requirements.txt

# 启动（默认端口8188）
python main.py --listen 0.0.0.0

# 后台启动
nohup python main.py --listen 0.0.0.0 > comfyui.log 2>&1 &
```

在后台管理页面配置：
- 服务类型: ComfyUI
- 地址: 127.0.0.1（本机）或实际IP
- 端口: 8188

### Ollama（对话服务）

```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 拉取模型
ollama pull llama2

# 启动服务（默认端口11434）
ollama serve
```

## 五、系统服务配置

创建 systemd 服务实现开机自启：

```bash
sudo nano /etc/systemd/system/dunhuang.service
```

内容：

```ini
[Unit]
Description=Dunhuang AI Design Platform
After=network.target postgresql.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/project
Environment="NODE_ENV=production"
Environment="PORT=5000"
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable dunhuang
sudo systemctl start dunhuang
sudo systemctl status dunhuang
```

## 六、防火墙配置

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 5000/tcp
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --add-port=5000/tcp --permanent
sudo firewall-cmd --reload
```

## 七、访问地址

部署完成后：

1. **本机访问**: `http://localhost:5000`
2. **局域网访问**: `http://<服务器IP>:5000`
3. **后台管理**: `http://<服务器IP>:5000/admin`

> ⚠️ 管理员账户需在部署后首次访问时自行注册，或通过数据库 `seed` 脚本创建。禁止使用默认密码。

## 八、常见问题

### Q1: 局域网无法访问

```bash
# 检查服务状态
ss -tlnp | grep 5000

# 检查防火墙
sudo ufw status

# 确认监听地址是 0.0.0.0 而不是 127.0.0.1
ss -tlnp | grep 5000
# 应显示: 0.0.0.0:5000 或 :::5000
```

### Q2: 数据库连接失败

```bash
# 测试数据库连接
psql -h localhost -U dunhuang -d dunhuang_design

# 检查 PostgreSQL 服务
sudo systemctl status postgresql
```

### Q3: 图片生成失败

1. 检查 COZE_API_TOKEN 是否配置
2. 或配置本地 ComfyUI 服务
3. 在后台管理页面测试 API 连通性

## 九、性能优化

### 内存优化

```env
# .env
NODE_OPTIONS=--max-old-space-size=4096
```

### 数据库连接池

已在 `src/db/index.ts` 配置：
- 最大连接数: 10
- 空闲超时: 30秒
- 连接超时: 2秒

### PM2 集群模式（可选）

```bash
# 安装 PM2
npm install -g pm2

# 启动集群（4个进程）
pm2 start dist/server.js -i 4 --name dunhuang

# 保存配置
pm2 save
pm2 startup
```
