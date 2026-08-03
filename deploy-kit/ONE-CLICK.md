# 🎯 超简单一键部署 - 只需复制粘贴！

## ✅ 你需要做的（只需5个命令）

### 命令1：检查F盘（1秒）

```cmd
dir F:\
```

**如果显示"驱动器找不到"** → 插入移动硬盘

---

### 命令2：安装PostgreSQL（5-10分钟）

```cmd
winget install PostgreSQL.PostgreSQL --accept-package-agreements --accept-source-agreements
```

**等待显示 "Successfully installed"**

---

### 命令3：下载并运行安装脚本（2-3分钟）

创建临时文件夹：
```cmd
mkdir %USERPROFILE%\Desktop\deploy-kit
cd %USERPROFILE%\Desktop\deploy-kit
```

**然后下载脚本文件到这个文件夹，右键 `install-f-drive.bat` → 以管理员身份运行**

---

### 命令4：复制项目并启动（5-15分钟）

```cmd
# 假设你的项目在 C:\path\to\dunhuang-design
# 复制到F盘
xcopy "C:\path\to\dunhuang-design" "F:\dunhuang-design\project\workspace\projects\" /E /I /Y

# 进入项目目录
cd F:\dunhuang-design\project\workspace\projects

# 安装依赖
pnpm install

# 运行数据库迁移
pnpm db:push

# 启动服务
pnpm start
```

---

### 命令5：访问应用（1秒）

浏览器打开：`http://localhost:5000`

---

## 🔍 部署验证

### 验证1：检查F盘结构

```cmd
dir F:\dunhuang-design
```

**应该显示：**
```
postgres
backups
logs
scripts
project
```

### 验证2：检查数据库

```cmd
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -d dunhuang_design -c "SELECT COUNT(*) FROM users;"
```

**应该显示数字（>0）**

### 验证3：检查服务

```cmd
netstat -ano | findstr :5000
```

**应该显示监听状态的进程**

---

## ❌ 遇到问题？

### 问题1：F盘不存在

```cmd
# 查看所有盘符
wmic logicaldisk get name
```

如果F盘不在列表，重新插拔移动硬盘

### 问题2：PostgreSQL安装失败

手动下载：https://www.postgresql.org/download/windows/

### 问题3：端口被占用

```cmd
# 查找占用5000端口的进程
netstat -ano | findstr :5000
# 杀掉进程
taskkill /PID [进程ID] /F
```

### 问题4：依赖安装失败

```cmd
# 清除缓存重试
pnpm store prune
pnpm install
```

---

## 🎉 完成！

看到首页了吗？恭喜部署成功！

**下一步：**
1. 注册一个测试账号
2. 访问后台配置API Key
3. 开始使用AI功能

---

**就是这么简单！** 🚀
