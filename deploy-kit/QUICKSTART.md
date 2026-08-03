# ⚡ 快速开始指南

## 5 分钟部署

### 1️⃣ 插入移动硬盘

确保移动硬盘已正确挂载（如 `D:` 盘）

### 2️⃣ 安装 PostgreSQL

**Windows 一键安装:**
```cmd
winget install PostgreSQL.PostgreSQL
```

或下载: https://www.postgresql.org/download/windows/

### 3️⃣ 一键部署

将 `deploy-kit` 文件夹复制到移动硬盘根目录，然后:

```cmd
D:
cd deploy-kit
install.bat
```

按提示完成安装，设置数据库密码

### 4️⃣ 启动服务

```cmd
cd scripts
start.bat
```

等待提示"服务启动成功"

### 5️⃣ 访问应用

浏览器打开: http://localhost:5000

## 🎯 首次使用

### 注册账号

1. 点击首页"注册"按钮
2. 输入邮箱和密码
3. 注册成功，默认 100 算力

### 管理员登录

```
邮箱: admin@example.com
密码: （请在首次登录后设置）
```

### 配置 API（可选）

1. 登录管理员账号
2. 进入后台: http://localhost:5000/admin
3. 系统设置 → API 配置管理
4. 填写 API Key

## 📱 局域网访问

### 查看本机 IP

**Windows:**
```cmd
ipconfig
```

找到 IPv4 地址，如: `192.168.1.100`

### 局域网访问

其他设备访问: `http://192.168.1.100:5000`

## 🛑 停止服务

```cmd
cd scripts
stop.bat
```

等待提示"服务已停止"后可移除移动硬盘

## ⚠️ 常见问题

### Q: 数据库启动失败？
**A:** 检查 PostgreSQL 是否已安装，运行 `install.bat` 重新配置

### Q: 无法局域网访问？
**A:**
1. 检查防火墙是否允许端口 5000
2. 确认应用监听 0.0.0.0（默认配置）

### Q: 算力不足？
**A:** 管理员在后台给用户充值

### Q: 如何备份数据？
**A:** 运行 `scripts/backup.bat`，自动备份到 `backups` 目录

## 📞 需要帮助？

查看完整文档: [README.md](./README.md)

---

**祝你使用愉快！** 🎉
