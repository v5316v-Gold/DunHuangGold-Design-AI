# 📖 敦煌金 AI 设计平台 - F盘超详细部署手册

## 📋 部署前检查清单

在开始之前，请确认以下条件：

- [ ] 已准备2TB移动固态硬盘
- [ ] 移动硬盘已插入电脑并显示为 **F:**
- [ ] 电脑操作系统为 Windows 10/11
- [ ] 已安装 Node.js（建议 v18+）
- [ ] 已安装 pnpm（`npm install -g pnpm`）

---

## 🔧 第一步：安装 PostgreSQL 17

### 方式1：使用 winget 安装（推荐，最简单）

1. 按 `Win + X`，选择 **终端(管理员)** 或 **PowerShell(管理员)**

2. 复制以下命令，按回车执行：

```powershell
winget install PostgreSQL.PostgreSQL
```

3. 等待安装完成，会显示 "Successfully installed"

4. 重启电脑（推荐）

---

### 方式2：手动下载安装（如 winget 失败）

1. 访问：https://www.postgresql.org/download/windows/

2. 下载最新的 Windows x86-64 安装包（约 300MB）

3. 双击安装包，按以下步骤操作：

   **安装界面步骤：**
   ```
   1. Next → 接受协议 → Next
   2. 安装目录：C:\Program Files\PostgreSQL\17
   3. 数据目录：C:\Program Files\PostgreSQL\17\data
   4. 端口：5432（默认）
   5. 设置密码：请记住这个密码！
      ⚠️ 密码要求至少8位，包含字母和数字
      示例：Dunhuang2024
   6. 区域设置：Locales → Chinese, Simplified → Next
   7. Next → Install
   8. 完成后，取消勾选 "Launch Stack Builder" → Finish
   ```

4. 安装完成后，验证安装：

   在命令行输入：
   ```cmd
   "C:\Program Files\PostgreSQL\17\bin\psql.exe" --version
   ```

   应显示：`psql (PostgreSQL) 17.x`

---

## 📦 第二步：下载部署文件

### 选项A：如果项目在云端工作区

1. 打开云端工作区，进入 `deploy-kit/` 目录

2. 下载以下文件到电脑桌面（或任意文件夹）：

   ```
   deploy-kit/
   ├── install-f-drive.bat    ← 必须下载
   ├── start.bat              ← 必须下载
   ├── stop.bat               ← 必须下载
   ├── backup.bat             ← 必须下载
   ├── restore.bat            ← 必须下载
   └── F-DRIVE-GUIDE.md       ← 可选，详细文档
   ```

3. 将这些文件放在同一个文件夹中，例如：
   ```
   C:\Users\你的用户名\Desktop\deploy-kit\
   ```

### 选项B：如果项目已下载到本地

如果项目已在本地，直接进入项目目录：
```cmd
cd C:\path\to\dunhuang-design\deploy-kit
```

---

## 💾 第三步：检查F盘状态

### 1. 确认F盘存在

打开 **文件资源管理器**，查看是否有 **F:** 盘符

如果看不到F盘：
- 重新插拔移动硬盘
- 检查磁盘管理（右键"此电脑" → 管理 → 磁盘管理）
- 可能需要给移动硬盘分配盘符

### 2. 检查F盘可用空间

按 `Win + R`，输入 `cmd`，按回车，然后执行：

```cmd
fsutil volume diskfree F:
```

**查看输出中的"可用字节数"：**
- 建议至少 100GB（约 100,000,000,000 字节）
- 2TB 硬盘应该显示 1,800,000,000,000+ 字节

**如果空间不足：**
- 清理F盘不必要的文件
- 使用更大的移动硬盘

---

## 🚀 第四步：运行安装脚本

### 1. 打开管理员命令提示符

**方法1：**
- 按 `Win + X`
- 选择 **终端(管理员)** 或 **命令提示符(管理员)**
- 点击"是"允许管理员权限

**方法2：**
- 在搜索框输入 "cmd"
- 右键点击"命令提示符"
- 选择 **以管理员身份运行**

### 2. 进入部署文件目录

在管理员命令提示符中，执行：

```cmd
cd C:\Users\你的用户名\Desktop\deploy-kit
```

（替换为你的实际路径）

### 3. 运行安装脚本

```cmd
install-f-drive.bat
```

### 4. 跟随提示完成安装

脚本会按以下步骤执行，请按提示操作：

---

## 📝 安装脚本详细流程

### 步骤 1/7：检查 F盘

**显示内容：**
```
✅ F盘已检测，可用空间: 1900 GB
```

**如果出错：**
```
❌ F盘不存在！
```
→ 检查移动硬盘是否插入，盘符是否为F：

---

### 步骤 2/7：检查 PostgreSQL

**正常显示：**
```
✅ PostgreSQL 17 已安装: C:\Program Files\PostgreSQL\17
```

**如果出错：**
```
❌ 未检测到 PostgreSQL 17
```
→ 返回 **第一步：安装 PostgreSQL 17**，重新安装

---

### 步骤 3/7：初始化数据库

**首次安装会提示：**
```
请设置 PostgreSQL 数据库密码（请记住此密码！）
数据库密码: _
```

**输入密码（示例）：**
```
Dunhuang2024!@#
```

**然后会显示：**
```
正在初始化数据库...
✅ 数据库初始化成功
```

**如果已存在数据库：**
```
⚠️  数据库已存在，跳过初始化
```
→ 正常，继续下一步

---

### 步骤 4/7：配置 PostgreSQL

**自动显示：**
```
✅ 配置文件已更新
```

会在F盘创建配置文件：
```
F:\dunhuang-design\postgres\postgresql.conf
F:\dunhuang-design\postgres\pg_hba.conf
```

---

### 步骤 5/7：启动 PostgreSQL

**显示内容：**
```
✅ PostgreSQL 已启动
创建应用数据库...
✅ 数据库创建成功
```

**如果启动失败：**
```
❌ PostgreSQL 启动失败
查看日志: F:\dunhuang-design\logs\pg.log
```

**故障排查：**
1. 检查日志文件：
   ```cmd
   type F:\dunhuang-design\logs\pg.log
   ```
2. 常见错误：
   - 端口5432被占用 → 关闭其他PostgreSQL实例
   - 权限不足 → 确保以管理员身份运行

---

### 步骤 6/7：复制管理脚本

**显示内容：**
```
✅ 管理脚本已复制
```

如果脚本不在当前目录，会跳过此步骤（不影响部署）

---

### 步骤 7/7：生成配置文件

**显示内容：**
```
请输入 PostgreSQL 数据库密码: _
```

输入与步骤3相同的密码

**然后显示：**
```
✅ 配置文件已创建: F:\dunhuang-design\project\.env.local
```

---

## ✅ 安装完成提示

脚本最后会显示：

```
========================================
    🎉 部署完成！
========================================

📂 部署位置: F:\dunhuang-design

📋 目录结构:
    F:\dunhuang-design\
    ├── postgres\          # PostgreSQL 数据
    ├── backups\           # 备份文件
    ├── logs\              # 日志文件
    ├── scripts\           # 管理脚本
    └── project\           # 项目代码

🔑 数据库配置:
    主机: 127.0.0.1
    端口: 5432
    数据库: dunhuang_design
    用户: postgres
    密码: [已设置]

📝 下一步操作:

1. 将项目代码复制到 F:\dunhuang-design\project\

2. 进入项目目录并运行迁移:
   cd F:\dunhuang-design\project\workspace\projects
   pnpm db:push

3. 启动服务:
   F:\dunhuang-design\scripts\start.bat

4. 访问应用:
   http://localhost:5000

💡 管理员账号:
   邮箱: admin@example.com
   密码: 首次登录后设置
```

按任意键关闭安装脚本

---

## 📂 第五步：复制项目代码到F盘

### 方式1：从云端下载项目代码

1. 在云端工作区，将整个项目打包下载（zip格式）

2. 解压到本地电脑

3. 将项目文件夹复制到F盘：
   ```
   源路径：C:\Users\你的用户名\Downloads\dunhuang-design\
   目标路径：F:\dunhuang-design\project\workspace\projects\
   ```

### 方式2：使用 Git 克隆（如果你有Git仓库）

```cmd
cd F:\dunhuang-design\project\workspace
git clone https://github.com/your-repo/dunhuang-design.git projects
```

### 方式3：手动复制（适用于小项目）

1. 打开项目文件夹
2. 选择所有文件（Ctrl + A）
3. 复制（Ctrl + C）
4. 打开 `F:\dunhuang-design\project\workspace\`
5. 创建 `projects` 文件夹
6. 粘贴（Ctrl + V）

### 确认目录结构正确

最终应该是：
```
F:\dunhuang-design\project\workspace\projects\
├── src\
│   ├── app\
│   ├── components\
│   └── ...
├── node_modules\  (可选，稍后会安装)
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── next.config.js
└── .env.local  (由安装脚本创建)
```

---

## 🔧 第六步：安装项目依赖

### 1. 打开命令提示符（无需管理员）

按 `Win + R`，输入 `cmd`，按回车

### 2. 进入项目目录

```cmd
cd F:\dunhuang-design\project\workspace\projects
```

### 3. 安装依赖

```cmd
pnpm install
```

**这个过程可能需要 5-10 分钟**，取决于网络速度

**显示内容：**
```
Packages: +XXX
Progress: resolved XXX, reused XXX, downloaded XXX, added XXX

Done in 123s
```

**如果出错：**
```
error pnpm is not recognized
```
→ 安装 pnpm：
```cmd
npm install -g pnpm
```

---

## 🗄️ 第七步：运行数据库迁移

### 1. 确保在项目目录

```cmd
cd F:\dunhuang-design\project\workspace\projects
```

### 2. 运行迁移命令

```cmd
pnpm db:push
```

**正常显示：**
```
drizzle-kit: v0.x.x
Running on database: postgresql://postgres:***@127.0.0.1:5432/dunhuang_design

Changes applied:
┌─────────────────┬──────────┐
│ Table           │ Type     │
├─────────────────┼──────────┤
│ users           │ create   │
│ power_logs      │ create   │
│ api_configs     │ create   │
│ works           │ create   │
│ tasks           │ create   │
│ system_settings │ create   │
└─────────────────┴──────────┘

√ Generated in 1.23s
```

**如果出错：**

**错误1：连接失败**
```
Error: connection refused
```
→ 检查PostgreSQL是否启动：
```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "F:\dunhuang-design\postgres" status
```

如果显示"not running"，启动它：
```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "F:\dunhuang-design\postgres" -l "F:\dunhuang-design\logs\pg.log" start
```

**错误2：密码错误**
```
Error: password authentication failed
```
→ 检查 `.env.local` 文件中的数据库密码是否正确

---

## 🚀 第八步：启动服务

### 1. 使用启动脚本（推荐）

双击运行：
```
F:\dunhuang-design\scripts\start.bat
```

**显示内容：**
```
========================================
   敦煌金 AI 设计平台 - 启动服务
========================================

[1/2] 启动 PostgreSQL 数据库...
    验证数据库连接...
✅ 数据库启动成功

[2/2] 启动 Web 应用...
✅ Web 应用启动成功

========================================
   服务启动成功
========================================

📍 访问地址:
   本机: http://localhost:5000
   局域网: http://192.168.1.100:5000

📊 管理后台: http://localhost:5000/admin

💡 提示:
   - 停止服务请运行 scripts\stop.bat
   - 查看日志: F:\dunhuang-design\logs

```

### 2. 手动启动（备选）

```cmd
cd F:\dunhuang-design\project\workspace\projects
pnpm start
```

### 3. 等待启动完成

显示 "ready" 或类似提示后，继续下一步

---

## 🌐 第九步：访问应用

### 1. 打开浏览器

推荐使用 Chrome、Edge 或 Firefox

### 2. 访问地址

输入地址栏：
```
http://localhost:5000
```

### 3. 首次访问

应该看到敦煌金 AI 设计平台主页

---

## 👥 第十步：注册用户

### 1. 点击"注册"按钮

在首页右上角或登录区域找到"注册"

### 2. 填写注册信息

```
邮箱: yourname@example.com
密码: yourpassword123
确认密码: yourpassword123
昵称: （可选）
```

### 3. 点击"注册"按钮

**成功后显示：**
```
注册成功！默认算力: 100
```

---

## 🔐 第十一步：登录系统

### 普通用户登录

1. 点击"登录"
2. 输入注册的邮箱和密码
3. 点击"登录"

### 管理员登录

```
邮箱: admin@example.com
密码: change_me_after_first_login
```

**首次登录后：**
1. 进入后台: http://localhost:5000/admin
2. 修改管理员密码
3. 配置 API Key（如果需要使用 AI 功能）

---

## 📱 第十二步：局域网访问

### 1. 获取本机 IP 地址

打开命令提示符：
```cmd
ipconfig
```

找到 **IPv4 地址**，例如：
```
IPv4 地址 . . . . . . . . . . . : 192.168.1.100
```

### 2. 局域网设备访问

在手机或其他电脑浏览器输入：
```
http://192.168.1.100:5000
```

### 3. 如果无法访问

**检查防火墙：**

打开 PowerShell（管理员）：
```powershell
# 添加防火墙规则
netsh advfirewall firewall add rule name="Dunhuang-Web" dir=in action=allow protocol=TCP localport=5000

netsh advfirewall firewall add rule name="Dunhuang-DB" dir=in action=allow protocol=TCP localport=5432
```

**检查网络连接：**

在局域网其他设备上：
```cmd
ping 192.168.1.100
```

如果能 ping 通但无法访问，通常是防火墙问题

---

## 🛑 日常使用：启动和停止服务

### 启动服务

**方法1：双击脚本（最简单）**
```
F:\dunhuang-design\scripts\start.bat
```

**方法2：命令行**
```cmd
cd F:\dunhuang-design\scripts
start.bat
```

### 停止服务

**方法1：双击脚本**
```
F:\dunhuang-design\scripts\stop.bat
```

**方法2：命令行**
```cmd
cd F:\dunhuang-design\scripts
stop.bat
```

**显示内容：**
```
========================================
   敦煌金 AI 设计平台 - 停止服务
========================================

[1/2] 停止 Web 应用...
✅ Web 应用已停止

[2/2] 停止 PostgreSQL 数据库...
✅ PostgreSQL 已停止

========================================
   服务已停止
========================================

可以安全移除移动硬盘
```

---

## 💾 数据备份

### 自动备份

系统会自动备份数据库到：
```
F:\dunhuang-design\backups\dump_YYYYMMDD_HHMMSS.dump
```

### 手动备份

双击运行：
```
F:\dunhuang-design\scripts\backup.bat
```

**显示内容：**
```
正在备份数据库...
✅ 备份成功
   文件: F:\dunhuang-design\backups\dump_20241201_153045.dump
   大小: 15 MB
✅ 已清理7天前的备份
```

### 恢复数据

双击运行：
```
F:\dunhuang-design\scripts\restore.bat
```

按照提示选择备份文件进行恢复

---

## ⚠️ 常见问题和解决方案

### 问题1：安装脚本报错"找不到命令"

**现象：**
```
'winget' is not recognized
```

**解决：**
1. 确保使用 Windows 10/11
2. 打开 Microsoft Store，搜索 "App Installer" 并安装
3. 重启电脑

---

### 问题2：PostgreSQL 安装后无法启动

**现象：**
```
❌ PostgreSQL 启动失败
```

**排查步骤：**

1. 检查日志：
```cmd
type F:\dunhuang-design\logs\pg.log
```

2. 查看错误信息：
- 如果是 "port 5432 already in use"
  → 关闭其他 PostgreSQL 实例
- 如果是 "permission denied"
  → 检查 F 盘是否可写

3. 手动启动测试：
```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "F:\dunhuang-design\postgres" -l "F:\dunhuang-design\logs\pg.log" start
```

---

### 问题3：应用启动后无法访问

**现象：**
```
访问 http://localhost:5000 显示"无法访问此网站"
```

**解决：**

1. 检查应用是否真的启动：
```cmd
netstat -ano | findstr :5000
```

如果有输出（显示 PID），说明已启动

2. 检查防火墙：
```cmd
netsh advfirewall show allprofiles
```

如果显示"已启用"，添加规则：
```cmd
netsh advfirewall firewall add rule name="Dunhuang" dir=in action=allow protocol=TCP localport=5000
```

3. 尝试使用 127.0.0.1：
```
http://127.0.0.1:5000
```

---

### 问题4：数据库迁移失败

**现象：**
```
Error: relation "users" already exists
```

**解决：**

```sql
-- 连接数据库
psql -U postgres -h 127.0.0.1 -d dunhuang_design

-- 删除所有表（谨慎操作！）
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 退出
\q

-- 重新运行迁移
pnpm db:push
```

---

### 问题5：算力扣减失败

**现象：**
```
算力扣减失败，请联系管理员
```

**检查：**

1. 确认用户已登录
2. 检查用户算力是否足够
3. 查看数据库日志

**手动充值：**

登录管理员账号，进入后台 → 用户管理 → 充值

---

## 📊 数据库管理

### 手动连接数据库

```cmd
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -d dunhuang_design
```

**输入密码**（安装时设置的）

### 常用 SQL 命令

```sql
-- 查看所有用户
SELECT id, email, nickname, role, power, created_at FROM users ORDER BY created_at DESC;

-- 查看用户算力
SELECT email, power FROM users;

-- 给用户充值
UPDATE users SET power = power + 100 WHERE email = 'user@example.com';

-- 设置用户为管理员
UPDATE users SET role = 'admin' WHERE email = 'user@example.com';

-- 查看算力日志
SELECT * FROM power_logs ORDER BY created_at DESC LIMIT 20;

-- 查看最近的作品
SELECT id, user_id, type, status, created_at FROM works ORDER BY created_at DESC LIMIT 10;

-- 删除测试数据（谨慎！）
DELETE FROM power_logs WHERE user_id = 'test-user-id';
DELETE FROM works WHERE user_id = 'test-user-id';
DELETE FROM users WHERE email = 'test@example.com';
```

---

## 🔒 安全建议

### 1. 修改默认密码

首次登录后立即修改：
- 管理员密码
- 数据库密码

### 2. 配置防火墙

只允许局域网访问，不要开放到公网

### 3. 定期备份

建议每天运行一次备份：
```
F:\dunhuang-design\scripts\backup.bat
```

### 4. 监控日志

定期查看日志文件：
```
F:\dunhuang-design\logs\pg.log
F:\dunhuang-design\logs\app.log
```

---

## 📞 技术支持

如果遇到问题：

1. 查看日志文件
2. 参考本文档的"常见问题"部分
3. 检查配置文件 `.env.local`

---

## 🎉 完成！

现在你已经成功在F盘移动硬盘上部署了敦煌金 AI 设计平台！

**下一步可以：**
- ✅ 注册新用户
- ✅ 配置 API Key 使用 AI 功能
- ✅ 局域网多设备同时使用
- ✅ 定期备份数据

**祝你使用愉快！** 🚀
