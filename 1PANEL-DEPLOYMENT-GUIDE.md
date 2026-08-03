# 敦煌金 AI 设计平台 — 阿里云 + 1Panel 部署完整方案

> 本方案详细记录从零开始在阿里云服务器上通过 1Panel 管理面板部署敦煌金 AI 设计平台的全流程。
>
> **总耗时预估**：2-4 小时（不含购买等待时间）
>
> **费用预估**：
> - 阿里云服务器：约 30-80 元/月（入门级）
> - 域名（可选）：约 20-50 元/年
> - SSL 证书：免费（Let's Encrypt）

---

## 目录

1. [购买云服务器](#一购买云服务器)
2. [部署云服务器](#二部署云服务器)
3. [上传项目](#三上传项目)
4. [安装1Panel](#四安装1panel)
5. [操作1Panel](#五操作1panel)
6. [管理项目](#六管理项目)

---

## 一、购买云服务器

### 1.1 选择云服务商与地域

| 项目 | 推荐选择 | 说明 |
|------|---------|------|
| **服务商** | 阿里云 | 国内龙头，1Panel 有针对性适配 |
| **地域** | 距离你最近的城市 | 杭州、上海、北京、深圳等 |
| **可用区** | 随机 | 影响不大 |

### 1.2 选择服务器配置

**最低配置（学习/测试用）**

| 配置项 | 选择 | 说明 |
|--------|------|------|
| **CPU** | 2 核 | 够用 |
| **内存** | 4 GB | 最低要求 |
| **系统盘** | 40 GB SSD | 够用 |
| **系统** | Ubuntu 22.04 LTS | ⭐ 推荐，稳定，1Panel 支持好 |
| **带宽** | 3-5 Mbps | 够用，后期可升级 |
| **购买时长** | 1 个月（先试用）+ 1 年 | 长期买更便宜 |

**生产环境配置（正式上线）**

| 配置项 | 选择 | 说明 |
|--------|------|------|
| **CPU** | 2-4 核 | 建议 4 核 |
| **内存** | 8 GB | 必要，AI 应用内存消耗大 |
| **系统盘** | 80 GB SSD | 留足空间 |
| **数据盘** | 可选 100GB 高效云盘 | 存放数据 |
| **系统** | Ubuntu 22.04 LTS | 稳定版 |
| **带宽** | 5-10 Mbps | 按需升级 |

### 1.3 购买步骤

1. **访问阿里云**
   ```
   https://www.aliyun.com/
   ```
   登录你的淘宝/支付宝账号

2. **进入ECS购买页面**
   ```
   产品 → 云服务器 ECS → 立即购买
   ```

3. **基础配置**
   ```
   计费方式：包年包月（长期用）或按量付费（先试用）
   地域：选择离你近的（如华南-深圳）
   实例规格：ecs.s6-c1m2.xlarge（2核4G）或 ecs.c7.large（2核4G）
   镜像：Ubuntu 22.04 LTS 64位
   存储：ESSD云盘 40GB
   ```

4. **网络和安全组**
   ```
   带宽计费：按固定带宽 3-5 Mbps
   安全组：选择"新建安全组"
   ```

5. **系统配置**
   ```
   登录凭证：设置密码（记住！）/ 或上传密钥对
   实例名称：dunhuang-server
   ```

6. **确认订单**
   ```
   检查配置 → 确认购买 → 支付
   ```

### 1.4 购买后获取信息

购买成功后，在控制台获取以下信息：

```
✅ 公网 IP 地址：47.92.xx.xx（稍后会用到）
✅ 登录密码：（你设置的 root 密码）
✅ 实例 ID：i-xxxxxxxxx
```

---

## 二、部署云服务器

### 2.1 安全组配置（关键！）

安全组 = 防火墙，决定哪些端口可以访问。

**登录阿里云控制台**
```
https://ecs.console.aliyun.com/
→ 实例与镜像 → 实例 → 点击你的实例
→ 安全组 → 配置规则
```

**入方向规则需要开放以下端口：**

| 协议 | 端口范围 | 授权对象 | 说明 |
|------|---------|---------|------|
| SSH | 22 | 0.0.0.0/0 | 服务器登录 |
| HTTP | 80 | 0.0.0.0/0 | 网站访问 |
| HTTPS | 443 | 0.0.0.0/0 | 加密访问 |
| 自定义 | 5000 | 0.0.0.0/0 | 敦煌金应用端口 |
| 自定义 | 8188 | 0.0.0.0/0 | ComfyUI（可选） |
| 自定义 | 11434 | 0.0.0.0/0 | Ollama（可选） |

**添加安全组规则步骤：**

```
安全组 → 入方向规则 → 快速添加规则
↓
协议：TCP
端口范围：22/22
授权对象：0.0.0.0/0
描述：SSH登录
↓
端口范围：80/80
授权对象：0.0.0.0/0
描述：HTTP
↓
端口范围：443/443
授权对象：0.0.0.0/0
描述：HTTPS
↓
端口范围：5000/5000
授权对象：0.0.0.0/0
描述：敦煌金应用
```

### 2.2 SSH 连接测试

**Windows 用户推荐使用 FinalShell 或 Xshell**

这里以 FinalShell 为例（免费，支持 SSH）：

1. **下载 FinalShell**
   ```
   https://www.hostbuf.com/
   ```

2. **新建连接**
   ```
   文件 → 新建 SSH 连接
   ↓
   名称：敦煌金服务器
   主机：47.92.xx.xx（你的公网IP）
   端口：22
   用户名：root
   认证方式：密码
   密码：你设置的root密码
   ```

3. **连接**
   ```
   点击连接 → 接受主机密钥 → 进入服务器终端
   ```

4. **验证连接成功**
   终端里输入：
   ```bash
   root@dunhuang:~# cat /etc/os-release
   ```
   应该显示 Ubuntu 22.04 信息

### 2.3 服务器基础配置

连接成功后，在终端执行以下命令：

```bash
# 1. 更新系统（耐心等待）
apt update && apt upgrade -y

# 2. 安装基础工具
apt install -y curl wget git vim unzip htop net-tools

# 3. 设置时区
timedatectl set-timezone Asia/Shanghai

# 4. 验证时间
date
# 应该显示中国时间

# 5. 重启（如内核有更新）
reboot
```

### 2.4 域名解析（可选但推荐）

如果你有域名，建议解析到服务器：

```
阿里云控制台 → 域名与网站（万网）
↓
找到你的域名 → DNS解析
↓
添加记录：
  记录类型：A
  主机记录：www（或 @）
  记录值：47.92.xx.xx（你的公网IP）
  TTL：10分钟

再添加一条：
  记录类型：A
  主机记录：@
  记录值：47.92.xx.xx
```

没有域名？先用 IP 访问，完全可行！

---

## 三、上传项目

### 3.1 本地准备工作（Windows）

**第一步：安装 WSL（如果你还没有）**

打开 PowerShell（管理员）执行：
```powershell
wsl --install
```
重启电脑后，Ubuntu 会自动安装。

**第二步：安装 rz/ sz（上传下载工具）**

在 WSL 终端执行：
```bash
sudo apt install lrzsz
```

**第三步：本地打包项目**

打开 WSL 终端，执行：

```bash
cd /mnt/e/dunhuang-design/projects

# 查看项目大小
du -sh .
# 预期：包含node_modules可能很大

# 创建优化打包（排除不必要的文件）
tar -czvf ~/dunhuang-ai-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='deploy-kit' \
  --exclude='webui' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  --exclude='pnpm-lock.yaml' \
  --exclude='.env*' \
  --exclude='dist' \
  .
```

> **为什么要排除这些？**
> - `node_modules`：服务器上重新安装
> - `.next/dist`：重新构建
> - `.git`：不需要
> - `deploy-kit`：本地脚本
> - `*.log`：日志文件
> - `.env*`：包含敏感信息，到服务器重新创建

**验证打包结果：**
```bash
ls -lh ~/dunhuang-ai-deploy.tar.gz
# 预期：几十 MB 到几百 MB（取决于代码量）
```

### 3.2 上传到服务器

**方法一：通过 FinalShell 直接上传（最简单）**

```
FinalShell → 找到 /root 目录
↓
右键 → 上传 → 选择 dunhuang-ai-deploy.tar.gz
↓
等待上传完成（约5-15分钟）
```

**方法二：通过 scp 命令**

在 WSL 终端执行：
```bash
# 上传到服务器
scp ~/dunhuang-ai-deploy.tar.gz root@47.92.xx.xx:/root/

# 输入服务器 root 密码
```

### 3.3 服务器解压

```bash
# SSH 登录服务器（或在 FinalShell 终端）

# 查看上传的文件
ls -lh /root/dunhuang-ai-deploy.tar.gz

# 解压到 /opt 目录
cd /opt
tar -xzvf /root/dunhuang-ai-deploy.tar.gz

# 重命名文件夹（可选）
mv projects dunhuang-ai

# 验证解压结果
ls -la /opt/dunhuang-ai/
# 应该看到 package.json, src/, next.config.ts 等文件

# 清理压缩包
rm /root/dunhuang-ai-deploy.tar.gz
```

---

## 四、安装 1Panel

### 4.1 1Panel 简介

> 1Panel 是新一代开源 Linux 服务器管理面板，唯一原生支持 AI Agent（Ollama、OpenClaw）的面板。

**官网**：[https://1panel.pro](https://1panel.pro)
**文档**：[https://1panel.cn/docs](https://1panel.cn/docs)

### 4.2 一键安装 1Panel

```bash
# SSH 登录服务器后，执行以下命令：

curl -sSL https://resource.1panel.pro/quick_start.sh | bash
```

安装过程约 3-5 分钟，自动完成以下操作：
- ✅ 检测系统环境
- ✅ 安装 Docker（容器引擎）
- ✅ 安装 1Panel 本身
- ✅ 配置防火墙

### 4.3 安装完成信息

安装成功后，显示类似以下信息（**请记录下来**）：

```
███████  安装成功 ██████████████

1Panel 访问地址：https://47.92.xx.xx:20433
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
面板端口：20433
FlashFXP 端口：20443
数据库端口：20444
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
终端命令：1panel
工具箱命令：1panel toolbox
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
用户名：xxxxxxxx
密码：xxxxxxxx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

⚠️ **重要**：保存好用户名、密码和访问地址！

### 4.4 首次访问 1Panel

```
1. 打开浏览器（Chrome/Edge）
2. 访问：https://47.92.xx.xx:20433
3. 由于是自签名证书，点击"高级" → 继续前往
4. 输入用户名和密码登录
5. 首次登录会要求修改默认密码
6. 登录成功，进入 1Panel 控制台
```

---

## 五、操作 1Panel

登录 1Panel 后台，看到主界面。左侧是导航菜单。

### 5.1 安装 Docker（容器引擎）

```
左侧菜单 → 主机管理 → 容器
↓
如果没有安装，点击"安装 Docker"
↓
确认安装 → 等待完成（约3分钟）
↓
安装成功后，显示容器列表页面
```

### 5.2 安装 Nginx（Web 服务器）

```
左侧菜单 → 应用商店
↓
搜索 "nginx" 或在"服务器"分类下找到
↓
点击"Nginx" → 安装
↓
配置：
  - 版本：默认
  - 端口：80（主端口）、443（HTTPS）
  - 安装位置：/opt/1panel/nginx
↓
点击"确认安装"
↓
等待安装完成
```

### 5.3 安装 PostgreSQL（数据库）

```
左侧菜单 → 应用商店
↓
搜索 "postgresql" 或在"运行服务"分类下
↓
点击"PostgreSQL" → 安装
↓
配置：
  - 版本：15（推荐）或 16
  - 密码：设置一个强密码（记住！）
  - 端口：5432
  - 数据卷：pgdata
↓
点击"确认安装"
↓
等待安装完成
```

### 5.4 创建数据库

```
左侧菜单 → 数据库 → PostgreSQL
↓
找到已安装的 PostgreSQL → 点击"管理"
↓
 phpPgAdmin 或 命令行创建数据库：
↓
点击"Web终端" → 执行：
```sql
CREATE DATABASE dunhuang_design;
CREATE USER dunhuang WITH PASSWORD '你的强密码';
GRANT ALL PRIVILEGES ON DATABASE dunhuang_design TO dunhuang;
\q
```

### 5.5 安装 Redis（缓存，可选但推荐）

```
左侧菜单 → 应用商店
↓
搜索 "redis"
↓
点击"Redis" → 安装
↓
配置：
  - 版本：7
  - 密码：（设置一个，可选）
  - 端口：6379
↓
确认安装
```

### 5.6 创建敦煌金应用运行环境

**在 /opt/dunhuang-ai 目录下创建 .env.local 文件：**

通过 1Panel 的"文件管理"或 WebSSH 终端：

```bash
cd /opt/dunhuang-ai
vim .env.local
```

写入以下内容：

```env
# 数据库
DATABASE_URL=postgresql://dunhuang:你的数据库密码@localhost:5432/dunhuang_design

# JWT 密钥（生成随机字符串，例如：openssl rand -base64 32）
JWT_SECRET=这里填你生成的随机密钥

# AI 服务（至少配置一个）
# 智谱 AI
ZHIPU_API_KEY=你的智谱API密钥

# 可选：对象存储（用于存储生成的图片）
S3_ACCESS_KEY=你的访问密钥
S3_SECRET_KEY=你的访问密钥
S3_BUCKET=你的存储桶名
S3_ENDPOINT=你的S3端点

# 环境
NODE_ENV=production
COZE_PROJECT_ENV=PROD
PORT=5000
```

**生成 JWT_SECRET：**
```bash
openssl rand -base64 32
# 复制输出结果填入上面的 JWT_SECRET
```

---

## 六、管理项目

### 6.1 安装项目依赖

```bash
# 通过 1Panel 的 WebSSH 或 FinalShell 终端

cd /opt/dunhuang-ai

# 检查 Node.js 版本
node -v
# 预期：20.x 或更高

# 安装 pnpm
npm install -g pnpm

# 安装项目依赖
pnpm install
# 等待 5-15 分钟
```

### 6.2 构建项目

```bash
# 安装依赖完成后，构建生产版本
pnpm build

# 等待构建完成（约3-5分钟）
# 构建产物在 .next/ 目录
```

### 6.3 使用 PM2 管理应用（推荐）

PM2 是 Node.js 进程管理器，支持开机自启。

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
cd /opt/dunhuang-ai
pm2 start dist/server.js --name dunhuang-ai

# 或使用环境变量文件
pm2 start dist/server.js --name dunhuang-ai --env production

# 设置开机自启
pm2 startup
pm2 save

# 常用命令
pm2 status              # 查看状态
pm2 logs dunhuang-ai    # 查看日志
pm2 restart dunhuang-ai # 重启
pm2 stop dunhuang-ai    # 停止
```

### 6.4 配置 Nginx 反向代理

```
左侧菜单 → 网站 → 创建网站
↓
选择"静态网站"（因为 Next.js 是 Node.js 后端）
↓
填写信息：
  - 主域名：你的域名（或 IP）
  - 端口：5000
  - 备注：敦煌金AI设计平台
↓
点击"确认"
↓
自动创建反向代理配置
```

### 6.5 配置 SSL 证书（免费 Let's Encrypt）

```
左侧菜单 → 网站 → 找到你的网站
↓
点击"设置" → "SSL"
↓
选择"Let's Encrypt" → 申请
↓
域名验证通过后，自动配置 HTTPS
↓
开启强制 HTTPS
```

### 6.6 通过 1Panel 管理应用

**查看应用状态：**
```
左侧菜单 → 应用商店 → 已安装
↓
找到相关应用（PostgreSQL、Nginx、Redis）
↓
查看状态：运行中/已停止
```

**重启/停止/启动服务：**
```
点击应用卡片 → 管理 → 操作按钮
```

**查看日志：**
```
点击应用卡片 → 日志
```

**修改配置：**
```
点击应用卡片 → 设置
↓
修改配置后 → 重启应用生效
```

### 6.7 项目更新部署

```bash
# 1. 通过 Git 拉取最新代码（或重新上传）
cd /opt/dunhuang-ai
git pull

# 2. 重新安装依赖
pnpm install

# 3. 重新构建
pnpm build

# 4. 重启应用
pm2 restart dunhuang-ai

# 或
pm2 stop dunhuang-ai && pm2 start dist/server.js --name dunhuang-ai
```

### 6.8 数据库备份

```
通过 1Panel → 数据库 → PostgreSQL → 管理
↓
点击"备份" → 创建备份
↓
备份文件自动保存
```

或通过命令行：
```bash
pg_dump -U dunhuang -d dunhuang_design > /opt/backups/dunhuang_$(date +%Y%m%d).sql
```

### 6.9 监控与告警

```
1Panel → 主机监控
↓
查看 CPU、内存、网络、磁盘使用率
↓
设置告警规则（当资源使用过高时通知）
```

---

## 快速命令速查表

### 服务器终端命令

```bash
# 1Panel 命令
1panel              # 查看帮助
1panel toolbox      # 工具箱

# Docker 命令
docker ps           # 查看运行中的容器
docker-compose up -d  # 启动 docker-compose
docker-compose down   # 停止 docker-compose

# PM2 命令
pm2 status          # 查看应用状态
pm2 logs dunhuang-ai  # 查看应用日志
pm2 restart dunhuang-ai  # 重启应用

# 数据库命令
psql -U dunhuang -d dunhuang_design  # 连接数据库
```

### 1Panel 常用操作路径

```
安装软件：左侧菜单 → 应用商店
管理容器：左侧菜单 → 主机管理 → 容器
管理文件：左侧菜单 → 主机管理 → 文件
管理网站：左侧菜单 → 网站
管理数据库：左侧菜单 → 数据库
系统设置：左侧菜单 → 设置
监控：左侧菜单 → 主机监控
日志：左侧菜单 → 日志
```

---

## 常见问题排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 访问不了 1Panel | 端口未开放 | 阿里云安全组开放 20433 端口 |
| 访问不了网站 | Nginx/应用未启动 | pm2 status 查看状态 |
| 数据库连接失败 | 密码错误或数据库不存在 | 检查 .env.local 配置 |
| 502 Bad Gateway | Nginx 无法连接后端 | 检查应用是否在 5000 端口运行 |
| SSL 证书申请失败 | 域名未解析 | 先用 IP 访问，后续配置域名 |

---

## 下一步

现在你已经了解了完整流程！

**请开始第一步：购买阿里云服务器**

购买完成后告诉我，我继续一步一步教你操作。

准备好后请回复"我买好了"，然后把以下信息发给我：

1. 公网 IP 地址
2. root 密码
3. 选择的服务器配置（几核几G）
4. 操作系统（Ubuntu 22.04？）

我们开始！🚀
