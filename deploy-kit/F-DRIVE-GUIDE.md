# F盘快速部署指南

## 📋 前提条件

1. ✅ 移动硬盘已插入并挂载为 **F:**
2. ✅ 已安装 PostgreSQL 17
3. ✅ Node.js 和 pnpm 已安装

## 🚀 5分钟部署步骤

### 步骤 1: 安装 PostgreSQL（如未安装）

在PowerShell（管理员）中运行：

```powershell
winget install PostgreSQL.PostgreSQL
```

或下载安装包: https://www.postgresql.org/download/windows/

---

### 步骤 2: 复制部署文件

将以下文件复制到你的电脑：

```
deploy-kit/
├── install-f-drive.bat     # ← F盘专用安装脚本
├── start.bat               # 启动脚本
├── stop.bat                # 停止脚本
└── README.md
```

---

### 步骤 3: 运行安装脚本

**右键以管理员身份运行** `install-f-drive.bat`

```
双击 install-f-drive.bat
```

脚本会自动：
- ✅ 检查F盘可用空间
- ✅ 在F盘创建目录结构
- ✅ 初始化PostgreSQL数据库
- ✅ 创建 dunhuang_design 数据库
- ✅ 生成环境变量配置

---

### 步骤 4: 复制项目代码

将项目代码复制到F盘：

```powershell
# 如果在云环境工作区
# 将整个项目复制到 F:\dunhuang-design\project\workspace\

# 或使用命令行
xcopy "C:\path\to\projects" "F:\dunhuang-design\project\workspace\" /E /I /Y
```

**目标目录结构：**
```
F:\dunhuang-design\project\workspace\projects\
├── src/
├── node_modules/
├── package.json
└── ...
```

---

### 步骤 5: 运行数据库迁移

```powershell
cd F:\dunhuang-design\project\workspace\projects
pnpm db:push
```

这会自动创建所有数据库表：
- ✅ users（用户表）
- ✅ power_logs（算力日志）
- ✅ api_configs（API配置）
- ✅ works（作品记录）
- ✅ tasks（任务队列）

---

### 步骤 6: 启动服务

```powershell
F:\dunhuang-design\scripts\start.bat
```

等待看到提示：
```
✅ 数据库启动成功
✅ Web 应用启动成功

📍 访问地址:
   本机: http://localhost:5000
   局域网: http://192.168.x.x:5000
```

---

### 步骤 7: 访问应用

浏览器打开：http://localhost:5000

---

## 📁 F盘目录结构

部署完成后，F盘结构如下：

```
F:\
└── dunhuang-design\
    ├── postgres\              # PostgreSQL 数据
    │   ├── data/              # 数据库文件
    │   ├── postgresql.conf    # 配置文件
    │   └── pg_hba.conf        # 访问控制
    │
    ├── backups\               # 自动备份
    │   └── dump_*.dump
    │
    ├── logs\                  # 日志文件
    │   ├── pg.log             # 数据库日志
    │   └── app.log            # 应用日志
    │
    ├── scripts\               # 管理脚本
    │   ├── start.bat          # 启动服务
    │   ├── stop.bat           # 停止服务
    │   ├── backup.bat         # 备份数据库
    │   └── restore.bat        # 恢复数据库
    │
    └── project\               # 项目代码
        └── workspace\
            └── projects\
                ├── src/
                ├── node_modules/
                ├── package.json
                └── .env.local     # 环境变量
```

---

## 🔑 数据库配置信息

| 配置项 | 值 |
|--------|-----|
| 数据库类型 | PostgreSQL 17 |
| 主机 | 127.0.0.1 |
| 端口 | 5432 |
| 数据库名 | dunhuang_design |
| 用户名 | postgres |
| 密码 | （安装时设置的密码） |

连接字符串：
```
postgresql://postgres:你的密码@127.0.0.1:5432/dunhuang_design
```

---

## 👥 用户使用

### 注册新用户

1. 访问 http://localhost:5000
2. 点击"注册"
3. 输入邮箱和密码
4. 注册成功，默认100算力

### 管理员登录

```
邮箱: admin@example.com
密码: 首次登录后设置
```

访问后台: http://localhost:5000/admin

---

## 🌐 局域网访问

### 获取本机IP

```cmd
ipconfig
```

找到 IPv4 地址，如：`192.168.1.100`

### 局域网访问

其他设备（手机、其他电脑）访问：

```
http://192.168.1.100:5000
```

### 防火墙配置（如无法访问）

```cmd
# 允许端口 5000
netsh advfirewall firewall add rule name="Dunhuang" dir=in action=allow protocol=TCP localport=5000
```

---

## 🛑 日常管理

### 启动服务

```cmd
F:\dunhuang-design\scripts\start.bat
```

### 停止服务

```cmd
F:\dunhuang-design\scripts\stop.bat
```

### 备份数据库

```cmd
F:\dunhuang-design\scripts\backup.bat
```

自动备份到 `F:\dunhuang-design\backups\`

### 恢复数据库

```cmd
F:\dunhuang-design\scripts\restore.bat
```

---

## ⚠️ 常见问题

### Q1: 脚本运行报错"未检测到 PostgreSQL"

**A:** 需要先安装 PostgreSQL

```powershell
winget install PostgreSQL.PostgreSQL
```

### Q2: 数据库初始化失败

**A:** 检查F盘是否可写，是否有足够空间（至少50GB）

```cmd
fsutil volume diskfree F:
```

### Q3: 无法局域网访问

**A:**
1. 检查防火墙是否允许端口 5000
2. 确认所有设备在同一局域网
3. 使用 ping 命令测试连通性

### Q4: 如何卸载/重新部署

```cmd
# 停止服务
F:\dunhuang-design\scripts\stop.bat

# 删除F盘部署目录
rmdir /S /Q F:\dunhuang-design

# 重新运行安装脚本
install-f-drive.bat
```

---

## 📊 数据库操作

### 手动连接数据库

```cmd
psql -U postgres -h 127.0.0.1 -d dunhuang_design
```

### 查看所有用户

```sql
SELECT id, email, nickname, role, power FROM users;
```

### 给用户充值

```sql
UPDATE users SET power = power + 100 WHERE email = 'user@example.com';
```

### 查看算力日志

```sql
SELECT * FROM power_logs ORDER BY created_at DESC LIMIT 10;
```

---

## 🎉 完成！

现在你的移动硬盘已经部署完毕，可以：

- ✅ 插入任何Windows电脑，双击启动脚本即可使用
- ✅ 局域网多设备同时访问
- ✅ 数据全部存储在F盘，不依赖本地电脑
- ✅ 支持自动备份和恢复

**祝你使用愉快！** 🚀
