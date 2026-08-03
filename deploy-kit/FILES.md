# 📦 F盘部署包 - 文件清单

## 部署文件总览

本目录包含所有部署所需的文件和文档。

---

## 📄 部署脚本（必需）

### Windows 核心脚本

| 文件名 | 说明 | 使用时机 |
|--------|------|---------|
| `install-f-drive.bat` | **F盘专用安装脚本** | 首次部署时运行 |
| `start.bat` | 启动服务脚本 | 每次使用前运行 |
| `stop.bat` | 停止服务脚本 | 使用完或关闭前运行 |
| `backup.bat` | 数据库备份脚本 | 定期备份数据 |
| `restore.bat` | 数据库恢复脚本 | 数据损坏或迁移时使用 |

### macOS/Linux 脚本（跨平台使用）

| 文件名 | 说明 | 使用时机 |
|--------|------|---------|
| `start.sh` | 启动服务脚本 | macOS/Linux系统使用 |
| `stop.sh` | 停止服务脚本 | macOS/Linux系统使用 |

---

## 📖 文档文件

| 文件名 | 说明 | 适合人群 |
|--------|------|---------|
| `QUICK-REFERENCE.md` | **快速参考卡** | 熟悉部署流程的用户 |
| `FULL-GUIDE.md` | **完整详细指南** | 首次部署或遇到问题 |
| `WORKFLOW.md` | 流程图和决策树 | 喜欢可视化流程的用户 |
| `F-DRIVE-GUIDE.md` | F盘专用指南 | 针对F盘部署的详细说明 |
| `README.md` | 总体说明文档 | 了解项目整体架构 |
| `QUICKSTART.md` | 5分钟快速开始 | 想快速上手的用户 |

---

## ⚙️ 配置文件

| 文件名 | 说明 | 位置 |
|--------|------|------|
| `.env.template` | 环境变量模板 | 复制后修改为 `.env.local` |

---

## 🎯 推荐阅读顺序

### 第一次部署

```
1. QUICKSTART.md (5分钟了解)
   ↓
2. FULL-GUIDE.md (详细操作步骤)
   ↓
3. 运行 install-f-drive.bat
   ↓
4. QUICK-REFERENCE.md (后续使用参考)
```

### 遇到问题

```
1. QUICK-REFERENCE.md (快速查看命令)
   ↓
2. FULL-GUIDE.md → 常见问题部分
   ↓
3. WORKFLOW.md (查看流程和决策树)
   ↓
4. 仍无法解决 → 记录错误信息寻求帮助
```

---

## 📋 文件大小参考

| 文件类型 | 大小范围 | 说明 |
|---------|---------|------|
| 脚本文件 | 1-10 KB | 轻量级 |
| 文档文件 | 10-50 KB | 详细说明 |
| 项目代码 | 50-200 MB | 取决于依赖 |
| 数据库文件 | 初始1MB，随数据增长 | 存储在F盘 |

---

## 🔍 文件内容预览

### install-f-drive.bat 核心功能

```batch
[检查F盘]
   ↓
[检查PostgreSQL安装]
   ↓
[设置数据库密码]
   ↓
[初始化数据库]
   ↓
[配置访问控制]
   ↓
[启动PostgreSQL]
   ↓
[创建应用数据库]
   ↓
[生成环境变量]
   ↓
[显示部署信息]
```

### start.bat 核心功能

```batch
[启动PostgreSQL]
   ↓
[验证数据库连接]
   ↓
[启动Web应用]
   ↓
[显示访问地址]
```

### backup.bat 核心功能

```batch
[创建备份目录]
   ↓
[执行pg_dump]
   ↓
[清理旧备份]
   ↓
[显示备份结果]
```

---

## 📁 部署后的文件结构

执行安装后，F盘结构：

```
F:\dunhuang-design\
├── postgres\              # 由 install-f-drive.bat 创建
│   ├── data\              # 数据库文件
│   ├── postgresql.conf    # 配置文件
│   └── pg_hba.conf        # 访问控制
│
├── backups\               # 自动备份目录
│   └── dump_*.dump        # 备份文件
│
├── logs\                  # 日志目录
│   ├── pg.log             # 数据库日志
│   └── app.log            # 应用日志
│
├── scripts\               # 管理脚本
│   ├── start.bat          # 启动服务
│   ├── stop.bat           # 停止服务
│   ├── backup.bat         # 备份数据
│   └── restore.bat        # 恢复数据
│
└── project\               # 项目代码
    └── workspace\
        └── projects\
            ├── src\       # 源代码
            ├── node_modules\  # 依赖
            ├── package.json
            ├── .env.local  # 环境变量
            └── ...         # 其他文件
```

---

## 🎓 使用场景对照

### 场景1：首次部署

**需要文件：**
- `install-f-drive.bat`
- `FULL-GUIDE.md`

**步骤：**
1. 阅读 `FULL-GUIDE.md` 的"安装PostgreSQL"部分
2. 运行 `install-f-drive.bat`
3. 按提示完成部署

---

### 场景2：日常使用

**需要文件：**
- `start.bat`
- `stop.bat`
- `QUICK-REFERENCE.md`

**步骤：**
1. 双击 `start.bat` 启动
2. 使用应用
3. 双击 `stop.bat` 停止

---

### 场景3：数据备份

**需要文件：**
- `backup.bat`
- `restore.bat`

**步骤：**
1. 双击 `backup.bat` 备份
2. 如需恢复：双击 `restore.bat`

---

### 场景4：跨平台使用

**需要文件：**
- `start.sh`
- `stop.sh`
- `FULL-GUIDE.md`

**步骤：**
1. 在 macOS/Linux 上
2. 运行 `bash start.sh` 启动
3. 运行 `bash stop.sh` 停止

---

### 场景5：故障排查

**需要文件：**
- `FULL-GUIDE.md` → "常见问题"
- `WORKFLOW.md` → "错误处理流程"
- 日志文件：`F:\dunhuang-design\logs\*`

**步骤：**
1. 查看错误信息
2. 阅读文档中的解决方案
3. 按流程排查

---

## 🔄 文件更新说明

### 脚本文件

脚本文件是静态的，部署后不需要更新。

### 项目代码

如需更新项目代码：
1. 停止服务：`stop.bat`
2. 备份数据：`backup.bat`
3. 替换 `F:\dunhuang-design\project\workspace\projects\` 下的代码
4. 运行迁移（如需要）：`pnpm db:push`
5. 启动服务：`start.bat`

### 文档文件

如有新版本的文档，可以替换本目录下的 `.md` 文件。

---

## ✅ 部署前检查

在开始部署前，确保：

- [ ] 已准备好以下文件：
  - [ ] `install-f-drive.bat`
  - [ ] `start.bat`
  - [ ] `stop.bat`
  - [ ] `backup.bat`
  - [ ] `restore.bat`
- [ ] 已阅读 `QUICKSTART.md` 或 `FULL-GUIDE.md`
- [ ] PostgreSQL 17 已安装
- [ ] F盘移动硬盘已插入
- [ ] Node.js 和 pnpm 已安装

---

## 📞 文件相关帮助

如果对某个文件有疑问：

1. 查看文件开头的注释说明
2. 参考对应的文档
3. 查看 `README.md` 了解整体架构

---

**现在你已经了解了所有文件的作用，可以开始部署了！** 🚀

**建议从阅读 `QUICKSTART.md` 开始。**
