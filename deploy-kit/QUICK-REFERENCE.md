# 🚀 F盘部署快速参考卡

## 📋 部署流程（12步）

| 步骤 | 操作 | 命令/操作 |
|-----|------|----------|
| 1 | 安装 PostgreSQL 17 | `winget install PostgreSQL.PostgreSQL` |
| 2 | 下载部署文件 | 下载 `install-f-drive.bat` 等文件 |
| 3 | 检查F盘 | 打开文件资源管理器确认F盘存在 |
| 4 | 运行安装脚本 | 右键 `install-f-drive.bat` → 以管理员身份运行 |
| 5 | 复制项目代码 | 复制到 `F:\dunhuang-design\project\workspace\projects\` |
| 6 | 安装依赖 | `cd F:\dunhuang-design\project\workspace\projects` → `pnpm install` |
| 7 | 数据库迁移 | `pnpm db:push` |
| 8 | 启动服务 | 双击 `F:\dunhuang-design\scripts\start.bat` |
| 9 | 访问应用 | 浏览器打开 `http://localhost:5000` |
| 10 | 注册账号 | 首页点击"注册" |
| 11 | 登录系统 | 使用注册账号登录 |
| 12 | 局域网访问 | 其他设备访问 `http://你的IP:5000` |

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
```

### 管理后台
```
http://localhost:5000/admin
```

---

## 📁 F盘目录结构

```
F:\dunhuang-design\
├── postgres\          # 数据库文件
├── backups\           # 自动备份
├── logs\              # 日志文件
├── scripts\           # 管理脚本
│   ├── start.bat      # 启动服务
│   ├── stop.bat       # 停止服务
│   ├── backup.bat     # 备份数据
│   └── restore.bat    # 恢复数据
└── project\           # 项目代码
    └── workspace\
        └── projects\
            ├── src\
            ├── node_modules\
            ├── package.json
            └── .env.local
```

---

## ⚡ 常用命令

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

### 恢复数据库
```cmd
F:\dunhuang-design\scripts\restore.bat
```

### 查看数据库状态
```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "F:\dunhuang-design\postgres" status
```

### 连接数据库
```cmd
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -d dunhuang_design
```

---

## 🌐 获取本机IP

```cmd
ipconfig
```

找到 **IPv4 地址**，如：`192.168.1.100`

局域网访问：`http://192.168.1.100:5000`

---

## 🚨 故障排查

| 问题 | 解决方案 |
|-----|---------|
| PostgreSQL启动失败 | 检查日志 `type F:\dunhuang-design\logs\pg.log` |
| 端口被占用 | 关闭其他PostgreSQL实例或修改配置 |
| 无法访问网站 | 检查防火墙：`netsh advfirewall firewall add rule name="Dunhuang" dir=in action=allow protocol=TCP localport=5000` |
| 数据库连接失败 | 检查 `.env.local` 中的密码是否正确 |
| 依赖安装失败 | 尝试 `npm install` 或删除 `node_modules` 重装 |

---

## 📞 需要帮助？

查看完整文档：`FULL-GUIDE.md`

---

## ✅ 部署检查清单

- [ ] PostgreSQL 17 已安装
- [ ] F盘移动硬盘已插入
- [ ] 安装脚本执行成功
- [ ] 项目代码已复制到F盘
- [ ] 依赖安装完成
- [ ] 数据库迁移成功
- [ ] 服务启动成功
- [ ] 可以访问 http://localhost:5000
- [ ] 已注册测试账号
- [ ] 局域网访问正常（可选）

---

**打印此页面，方便部署时参考！** 📄
