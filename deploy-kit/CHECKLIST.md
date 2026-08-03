# ✅ F盘部署完整检查清单

使用此清单确保每个步骤都正确完成。

---

## 📋 准备阶段检查清单

### 硬件检查

- [ ] 移动固态硬盘已插入电脑
- [ ] 移动硬盘显示为 **F:** 盘符
- [ ] 硬盘可用空间 ≥ 100GB（2TB推荐）
- [ ] 硬盘连接正常（可读写）

**验证方法：**
```
打开"此电脑" → 查看是否有F盘
右键F盘 → 属性 → 查看可用空间
```

---

### 软件检查

- [ ] 操作系统为 Windows 10/11
- [ ] 已安装 PostgreSQL 17
- [ ] 已安装 Node.js（版本 18+）
- [ ] 已安装 pnpm

**验证方法：**
```cmd
# 检查 PostgreSQL
"C:\Program Files\PostgreSQL\17\bin\psql.exe" --version

# 检查 Node.js
node --version

# 检查 pnpm
pnpm --version
```

---

### 文件检查

- [ ] 已下载 `install-f-drive.bat`
- [ ] 已下载 `start.bat`
- [ ] 已下载 `stop.bat`
- [ ] 已下载 `backup.bat`
- [ ] 已下载 `restore.bat`
- [ ] 已阅读 `QUICKSTART.md` 或 `FULL-GUIDE.md`

**验证方法：**
```
检查下载文件夹，确认所有文件存在
```

---

## 🚀 安装阶段检查清单

### 运行安装脚本

- [ ] 以**管理员身份**运行 `install-f-drive.bat`
- [ ] 命令提示符显示"Administrator"
- [ ] 脚本成功检查到F盘
- [ ] 脚本成功检查到PostgreSQL 17

### 数据库初始化

- [ ] 成功设置数据库密码（已记住）
- [ ] 显示"✅ 数据库初始化成功"
- [ ] F盘创建 `postgres\` 目录
- [ ] 创建 `postgresql.conf` 和 `pg_hba.conf`

### 数据库启动

- [ ] 显示"✅ PostgreSQL 已启动"
- [ ] 创建 `dunhuang_design` 数据库成功
- [ ] 生成环境变量文件 `.env.local`

### 安装完成

- [ ] 显示"🎉 部署完成！"
- [ ] 显示部署信息（数据库配置、访问地址）
- [ ] 脚本正常退出

---

## 📂 项目部署检查清单

### 目录结构

- [ ] 创建 `F:\dunhuang-design\` 目录
- [ ] 创建 `postgres\` 子目录
- [ ] 创建 `backups\` 子目录
- [ ] 创建 `logs\` 子目录
- [ ] 创建 `scripts\` 子目录
- [ ] 创建 `project\` 子目录

**验证方法：**
```
打开文件资源管理器 → F:\dunhuang-design\
查看所有子目录是否存在
```

---

### 复制项目代码

- [ ] 项目代码已复制到 `F:\dunhuang-design\project\workspace\projects\`
- [ ] `src\` 目录存在
- [ ] `package.json` 文件存在
- [ ] `.env.local` 文件存在
- [ ] 项目文件完整无损坏

**验证方法：**
```
打开 F:\dunhuang-design\project\workspace\projects\
检查关键文件和目录
```

---

### 安装依赖

- [ ] 打开命令提示符（普通用户即可）
- [ ] 进入项目目录：
  ```cmd
  cd F:\dunhuang-design\project\workspace\projects
  ```
- [ ] 运行 `pnpm install` 成功
- [ ] 显示 "Packages: +XXX"
- [ ] 显示 "Done in XXXs"
- [ ] 创建 `node_modules\` 目录

**验证方法：**
```
进入项目目录 → dir node_modules
应该显示大量文件夹
```

---

### 数据库迁移

- [ ] 运行 `pnpm db:push` 成功
- [ ] 显示 "Changes applied:"
- [ ] 创建以下表：
  - [ ] users
  - [ ] power_logs
  - [ ] api_configs
  - [ ] works
  - [ ] tasks
  - [ ] system_settings
- [ ] 显示 "√ Generated in XXXs"

**验证方法：**
```cmd
# 连接数据库
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -d dunhuang_design

# 查看所有表
\dt

# 应该显示所有表
```

---

## 🔧 启动阶段检查清单

### 启动服务

- [ ] 双击 `F:\dunhuang-design\scripts\start.bat`
- [ ] 显示"✅ 数据库启动成功"
- [ ] 显示"✅ Web 应用启动成功"
- [ ] 显示访问地址：
  - 本机: http://localhost:5000
  - 局域网: http://192.168.x.x:5000

**验证方法：**
```
查看启动脚本输出
确认所有"✅"提示
```

---

### 服务运行检查

- [ ] PostgreSQL 进程运行中
- [ ] Node.js/Web应用 进程运行中
- [ ] 端口 5432 被监听（数据库）
- [ ] 端口 5000 被监听（Web应用）

**验证方法：**
```cmd
# 检查端口占用
netstat -ano | findstr :5432
netstat -ano | findstr :5000

# 应该显示监听状态的进程
```

---

### 访问检查

- [ ] 浏览器打开 `http://localhost:5000`
- [ ] 首页正常显示
- [ ] 网站样式正常加载
- [ ] 无控制台错误（按F12查看）

**验证方法：**
```
打开浏览器 → 访问 http://localhost:5000
检查页面是否正常显示
按F12 → Console标签 → 检查错误
```

---

## 👥 功能测试检查清单

### 注册功能

- [ ] 点击"注册"按钮
- [ ] 输入邮箱、密码、确认密码
- [ ] 点击"注册"成功
- [ ] 显示"注册成功！默认算力: 100"
- [ ] 自动登录成功

**测试数据示例：**
```
邮箱: test@example.com
密码: Test123456
确认密码: Test123456
```

---

### 登录功能

- [ ] 登出当前账号
- [ ] 点击"登录"按钮
- [ ] 输入注册的邮箱和密码
- [ ] 点击"登录"成功
- [ ] 显示用户信息和算力余额

**测试数据示例：**
```
邮箱: test@example.com
密码: Test123456
```

---

### 管理员登录

- [ ] 访问 http://localhost:5000/admin
- [ ] 输入管理员账号：
  ```
  邮箱: admin@example.com
  密码: change_me_after_first_login
  ```
- [ ] 成功进入管理后台
- [ ] 可以看到用户管理、API配置等功能

---

### 算力系统

- [ ] 用户注册后算力为 100
- [ ] 执行任何操作前检查算力是否足够
- [ ] 执行操作后算力正确扣减
- [ ] 算力不足时显示提示信息

**测试方法：**
```
1. 查看当前算力（应该为100）
2. 执行一次操作（如生成图片）
3. 查看剩余算力（应该减少）
```

---

## 🌐 局域网检查清单（可选）

### 获取本机IP

- [ ] 运行 `ipconfig`
- [ ] 找到 IPv4 地址（如：192.168.1.100）

### 局域网访问

- [ ] 在其他设备（手机/其他电脑）上访问
- [ ] 输入地址：`http://192.168.1.100:5000`
- [ ] 成功显示首页
- [ ] 可以注册新用户
- [ ] 可以正常登录

### 防火墙配置（如无法访问）

- [ ] 配置防火墙允许端口 5000
  ```cmd
  netsh advfirewall firewall add rule name="Dunhuang" dir=in action=allow protocol=TCP localport=5000
  ```
- [ ] 重新测试局域网访问

---

## 🛑 停止服务检查清单

### 正常停止

- [ ] 双击 `F:\dunhuang-design\scripts\stop.bat`
- [ ] 显示"✅ Web 应用已停止"
- [ ] 显示"✅ PostgreSQL 已停止"
- [ ] 显示"可以安全移除移动硬盘"

### 进程验证

- [ ] 检查 Node.js 进程已停止
- [ ] 检查 PostgreSQL 进程已停止
- [ ] 端口 5000 释放
- [ ] 端口 5432 释放

**验证方法：**
```cmd
netstat -ano | findstr :5000
netstat -ano | findstr :5432

# 不应该有任何输出
```

---

## 💾 备份检查清单

### 手动备份

- [ ] 双击 `F:\dunhuang-design\scripts\backup.bat`
- [ ] 显示"正在备份数据库..."
- [ ] 显示"✅ 备份成功"
- [ ] 显示备份文件路径和大小
- [ ] 显示"✅ 已清理7天前的备份"

### 备份文件验证

- [ ] 备份文件存在于 `F:\dunhuang-design\backups\`
- [ ] 备份文件命名格式：`dump_YYYYMMDD_HHMMSS.dump`
- [ ] 备份文件大小合理（> 1MB）

---

## 📊 数据完整性检查清单

### 数据库表验证

- [ ] 连接数据库：
  ```cmd
  "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -d dunhuang_design
  ```
- [ ] 列出所有表：
  ```sql
  \dt
  ```
- [ ] 确认所有表存在：
  - [ ] users
  - [ ] power_logs
  - [ ] api_configs
  - [ ] works
  - [ ] tasks
  - [ ] system_settings

### 数据记录验证

- [ ] 查看用户表：
  ```sql
  SELECT COUNT(*) FROM users;
  ```
  [ ] 至少有1个用户（管理员）

- [ ] 查看系统设置：
  ```sql
  SELECT * FROM system_settings;
  ```
  [ ] 至少有一些默认设置

---

## 🎯 最终验证清单

### 部署成功标志

- [ ] F盘目录结构完整
- [ ] PostgreSQL 服务正常
- [ ] Web 应用正常
- [ ] 数据库表全部创建
- [ ] 可以注册新用户
- [ ] 可以正常登录
- [ ] 算力系统工作正常
- [ ] （可选）局域网访问正常

### 所有服务运行

- [ ] PostgreSQL 进程运行中
- [ ] Web 应用进程运行中
- [ ] 端口 5432 监听
- [ ] 端口 5000 监听
- [ ] 可以访问 http://localhost:5000

### 数据完整性

- [ ] 数据库连接正常
- [ ] 所有表存在
- [ ] 用户数据正确
- [ ] 配置数据正确

---

## 🚨 故障排查检查清单

如果检查中有任何 ❌，按以下步骤排查：

### 1. 查看日志

- [ ] 查看数据库日志：
  ```cmd
  type F:\dunhuang-design\logs\pg.log
  ```
- [ ] 查看应用日志：
  ```cmd
  type F:\dunhuang-design\logs\app.log
  ```

### 2. 检查配置

- [ ] 检查 `.env.local` 文件
- [ ] 检查数据库密码是否正确
- [ ] 检查端口是否被占用

### 3. 重试操作

- [ ] 停止服务
- [ ] 检查配置
- [ ] 重新启动

### 4. 查阅文档

- [ ] 阅读 `FULL-GUIDE.md` 的"常见问题"
- [ ] 查看 `WORKFLOW.md` 的"错误处理流程"

---

## ✅ 完成确认

如果以上所有检查项都是 ✅，恭喜你！

```
🎉 恭喜！F盘部署完全成功！

你现在可以：
✅ 正常使用所有功能
✅ 注册和管理用户
✅ 配置 API Key 使用 AI 功能
✅ 局域网多设备同时访问
✅ 定期备份数据

下一步建议：
1. 修改默认管理员密码
2. 配置 API Key
3. 设置定期备份任务
4. 分享给局域网其他用户

祝你使用愉快！🚀
```

---

**打印此清单，在部署过程中逐项检查！** 📄
