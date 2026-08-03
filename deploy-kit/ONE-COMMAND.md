# 🎯 F盘一键部署 - 只需复制粘贴这6条命令！

## ⚠️ 部署前检查

1. 插入移动硬盘，确认显示为 **F:** 盘
2. 右键开始菜单 → 选择 **"终端(管理员)"** 或 **"Windows PowerShell(管理员)"**

---

## 📋 只需执行以下6条命令

### 第1条：检查F盘（30秒）

```powershell
dir F:\
```

**看到F盘内容了吗？** 如果报错说F盘不存在，跳到下面"如果F盘不存在"部分。

---

### 第2条：安装PostgreSQL（5-10分钟）

```powershell
winget install PostgreSQL.PostgreSQL --accept-package-agreements --accept-source-agreements
```

**等待显示 "Successfully installed"**

---

### 第3条：创建目录（1秒）

```powershell
mkdir F:\dunhuang-design\postgres, F:\dunhuang-design\backups, F:\dunhuang-design\logs, F:\dunhuang-design\scripts
```

---

### 第4条：初始化数据库（2分钟）

```powershell
& "C:\Program Files\PostgreSQL\17\bin\initdb.exe" -D "F:\dunhuang-design\postgres" -E UTF8 -U postgres -A md5 -W
```

**提示输入密码时，设置一个密码（记住它！），例如：`Dunghuang2024`**

---

### 第5条：启动数据库（1秒）

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "F:\dunhuang-design\postgres" -l "F:\dunhuang-design\logs\pg.log" start
```

---

### 第6条：创建数据库（1秒）

```powershell
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres dunhuang_design
```

---

## ✅ 数据库部署完成！

现在你需要做的是：

---

## 📝 记录你的密码

刚才设置的PostgreSQL密码（记住它）：`_______________`

---

## 📋 部署状态检查

执行以下命令验证：

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -d postgres -c "SELECT 1;"
```

**看到 "1 row" 成功了吗？**

---

## ⚠️ 如果F盘不存在

如果dir命令说F盘不存在，执行：

```powershell
wmic logicaldisk get name,volumename,size
```

**查看输出，找到你的移动硬盘是哪个盘符**，可能是D、E、G等。

**如果确实没有F盘**，用以下命令修改为你的实际盘符：

```powershell
$盘符 = "D:"  # 改成你的实际盘符
mkdir "${盘符}\dunhuang-design\postgres", "${盘符}\dunhuang-design\backups", "${盘符}\dunhuang-design\logs", "${盘符}\dunhuang-design\scripts"
```

---

## 📦 下一步：复制项目代码

### 方式1：如果项目代码在本地

```powershell
# 假设项目在 C:\Users\你的用户名\Downloads\dunhuang-design
# 复制到F盘
xcopy "C:\Users\你的用户名\Downloads\dunhuang-design" "F:\dunhuang-design\project\workspace\projects\" /E /I /Y
```

### 方式2：如果是云端项目

1. 从云端下载项目代码到本地
2. 解压到 `F:\dunhuang-design\project\workspace\projects\`

---

## ⚙️ 配置环境变量

在项目目录创建 `.env.local` 文件：

```powershell
# 进入项目目录
cd F:\dunhuang-design\project\workspace\projects

# 创建环境变量文件（把 YOUR_PASSWORD 改成你的数据库密码）
@"
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/dunhuang_design
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
"@ | Out-File -FilePath .env.local -Encoding UTF8
```

---

## 📥 安装依赖

```powershell
cd F:\dunhuang-design\project\workspace\projects
pnpm install
```

**等待完成（可能需要5-15分钟）**

---

## 🗄️ 运行数据库迁移

```powershell
cd F:\dunhuang-design\project\workspace\projects
pnpm db:push
```

---

## 🚀 启动服务

```powershell
cd F:\dunhuang-design\project\workspace\projects
pnpm start
```

---

## 🌐 访问应用

浏览器打开：`http://localhost:5000`

---

## ✅ 完成！

看到首页了吗？恭喜部署成功！

---

## 🛑 日常使用命令

### 启动服务

```powershell
cd F:\dunhuang-design\project\workspace\projects
pnpm start
```

### 停止服务

```powershell
taskkill /F /IM node.exe
& "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "F:\dunhuang-design\postgres" stop
```

### 备份数据库

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U postgres -h 127.0.0.1 -d dunhuang_design -F c -f "F:\dunhuang-design\backups\dump_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
```

---

## ❓ 常见问题

### Q: 第2条命令报错"winget不是内部命令"

**A:** 
```powershell
# 方法1：手动下载PostgreSQL
# 访问 https://www.postgresql.org/download/windows/
# 下载并安装

# 方法2：使用Chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
choco install postgresql --version=17 -y
```

---

### Q: 第4条命令报错"权限不足"

**A:** 确保以管理员身份运行终端

---

### Q: 第6条命令报错"数据库已存在"

**A:** 这是正常的，说明数据库已创建，跳过即可

---

### Q: pnpm install 报错

**A:**
```powershell
# 安装Node.js
winget install OpenJS.NodeJS

# 安装pnpm
npm install -g pnpm
```

---

## 📞 需要帮助？

如果遇到问题，告诉我：
1. 执行到哪一步？
2. 显示什么错误信息？

我会帮你解决！

---

**现在开始执行第1条命令吧！** 

```powershell
dir F:\
```

**把结果告诉我，我继续指导你！** 🚀
