# 敦煌金 AI 设计平台 - F盘部署包

## 🎯 项目简介

敦煌金 AI 设计平台是一个集成多种 AI 设计工具的在线工作台，包含文案生图、3D建模、浮雕设计、视频生成等功能。

本部署包支持将应用和数据库部署在F盘移动固态硬盘，实现即插即用。

---

## 📦 部署包内容

```
deploy-kit/
├── 📄 文档文件
│   ├── README.md              # 本文件（入口文档）
│   ├── QUICKSTART.md          # 5分钟快速开始 ⭐
│   ├── FULL-GUIDE.md          # 完整详细指南
│   ├── QUICK-REFERENCE.md     # 快速参考卡
│   ├── WORKFLOW.md            # 流程图和决策树
│   ├── F-DRIVE-GUIDE.md       # F盘专用指南
│   └── FILES.md               # 文件清单说明
│
├── 🔧 部署脚本（Windows）
│   ├── install-f-drive.bat    # F盘一键安装 ⭐
│   ├── start.bat              # 启动服务 ⭐
│   ├── stop.bat               # 停止服务
│   ├── backup.bat             # 数据库备份
│   └── restore.bat            # 数据库恢复
│
├── 🔧 部署脚本（macOS/Linux）
│   ├── start.sh               # 启动服务
│   └── stop.sh                # 停止服务
│
└── ⚙️ 配置文件
    └── .env.template          # 环境变量模板
```

---

## 🚀 快速开始（3步）

### 第1步：准备环境

确保满足以下条件：
- ✅ 2TB移动固态硬盘已插入，显示为F:盘
- ✅ 已安装 PostgreSQL 17
- ✅ 已安装 Node.js 和 pnpm

**安装PostgreSQL（如未安装）：**
```cmd
winget install PostgreSQL.PostgreSQL
```

---

### 第2步：运行安装

1. 右键 `install-f-drive.bat` → 以管理员身份运行
2. 按提示设置数据库密码
3. 等待安装完成（约2-3分钟）

---

### 第3步：启动使用

1. 复制项目代码到 `F:\dunhuang-design\project\workspace\projects\`
2. 进入项目目录运行迁移：
   ```cmd
   cd F:\dunhuang-design\project\workspace\projects
   pnpm install
   pnpm db:push
   ```
3. 双击 `F:\dunhuang-design\scripts\start.bat` 启动
4. 浏览器打开 `http://localhost:5000`

---

## 📖 文档阅读指南

### 我想要...

| 需求 | 推荐文档 |
|-----|---------|
| 5分钟快速了解 | **QUICKSTART.md** ⭐ |
| 首次部署详细步骤 | **FULL-GUIDE.md** ⭐ |
| 查看快速参考 | **QUICK-REFERENCE.md** |
| 了解部署流程图 | **WORKFLOW.md** |
| F盘专用说明 | **F-DRIVE-GUIDE.md** |
| 了解文件用途 | **FILES.md** |

---

## 🔑 关键信息

### 数据库配置

```
主机: 127.0.0.1
端口: 5432
数据库: dunhuang_design
用户: postgres
密码: （安装时设置的密码）
```

### 默认管理员

```
邮箱: admin@example.com
密码: change_me_after_first_login
后台: http://localhost:5000/admin
```

### 访问地址

```
本机: http://localhost:5000
局域网: http://192.168.x.x:5000
```

---

## 📁 F盘部署结构

```
F:\dunhuang-design\
├── postgres\              # PostgreSQL 数据
├── backups\               # 自动备份
├── logs\                  # 日志文件
├── scripts\               # 管理脚本
│   ├── start.bat          # 启动服务
│   ├── stop.bat           # 停止服务
│   ├── backup.bat         # 备份数据
│   └── restore.bat        # 恢复数据
└── project\               # 项目代码
    └── workspace\
        └── projects\
            ├── src\
            ├── node_modules\
            ├── package.json
            └── .env.local
```

---

## 💡 日常使用

### 启动服务

```cmd
F:\dunhuang-design\scripts\start.bat
```

### 停止服务

```cmd
F:\dunhuang-design\scripts\stop.bat
```

### 备份数据

```cmd
F:\dunhuang-design\scripts\backup.bat
```

### 恢复数据

```cmd
F:\dunhuang-design\scripts\restore.bat
```

---

## 👥 用户使用

### 注册新用户

1. 访问 http://localhost:5000
2. 点击"注册"
3. 输入邮箱和密码
4. 注册成功，默认100算力

### 管理员操作

1. 登录管理员账号
2. 访问后台 http://localhost:5000/admin
3. 用户管理、API配置、算力充值

---

## 🌐 局域网访问

### 获取本机IP

```cmd
ipconfig
```

找到 **IPv4 地址**，如：`192.168.1.100`

### 局域网访问

其他设备访问：`http://192.168.1.100:5000`

### 防火墙配置（如无法访问）

```cmd
netsh advfirewall firewall add rule name="Dunhuang" dir=in action=allow protocol=TCP localport=5000
```

---

## ⚠️ 常见问题

### Q: 脚本运行报错"未检测到 PostgreSQL"

**A:** 安装 PostgreSQL 17
```cmd
winget install PostgreSQL.PostgreSQL
```

### Q: 数据库启动失败

**A:** 查看日志文件
```cmd
type F:\dunhuang-design\logs\pg.log
```

### Q: 无法局域网访问

**A:** 检查防火墙
```cmd
netsh advfirewall firewall add rule name="Dunhuang" dir=in action=allow protocol=TCP localport=5000
```

更多问题请查看 **FULL-GUIDE.md** 的"常见问题"部分

---

## 📊 功能特性

| 功能 | 说明 | 状态 |
|-----|------|------|
| 用户系统 | 注册、登录、权限管理 | ✅ |
| 算力管理 | 余额、消耗、充值 | ✅ |
| 文案生图 | 文字生成图片 | ✅ |
| AI对话 | 智能对话助手 | ✅ |
| 产品精修 | 图片优化 | ✅ |
| 多图融合 | 多张图片融合 | ✅ |
| 3D建模 | 图转3D模型 | ✅ |
| 视频生成 | 文生视频、图生视频 | ✅ |
| 实用工具 | 去背景、高清化、去水印 | ✅ |
| 管理后台 | 用户管理、API配置 | ✅ |
| 数据备份 | 自动备份、一键恢复 | ✅ |

---

## 🔒 安全建议

1. **修改默认密码**：首次登录后立即修改管理员密码
2. **配置防火墙**：只允许局域网访问，不要开放到公网
3. **定期备份**：建议每天运行一次 `backup.bat`
4. **监控日志**：定期查看 `F:\dunhuang-design\logs\` 下的日志文件

---

## 📞 技术支持

遇到问题时的解决流程：

1. 查看错误日志
2. 阅读文档中的"常见问题"部分
3. 检查配置文件 `.env.local`
4. 记录错误信息，寻求技术支持

---

## 📝 系统要求

### 硬件要求

| 组件 | 要求 |
|-----|------|
| 移动硬盘 | 2TB USB 3.2 固态硬盘 |
| 可用空间 | 至少 100GB |
| 内存 | 4GB 以上推荐 |

### 软件要求

| 组件 | 版本要求 |
|-----|---------|
| 操作系统 | Windows 10/11 |
| PostgreSQL | 17.x |
| Node.js | 18.x 或更高 |
| pnpm | 最新版本 |

---

## 🎉 开始部署

推荐阅读顺序：

```
1. QUICKSTART.md（5分钟了解）
   ↓
2. FULL-GUIDE.md（详细步骤）
   ↓
3. 运行 install-f-drive.bat
   ↓
4. QUICK-REFERENCE.md（后续参考）
```

---

**祝你部署顺利，使用愉快！** 🚀

---

## 📄 许可证

MIT License - 详见 LICENSE 文件
