# 🔧 找到PostgreSQL的正确路径

## 你的PostgreSQL在F盘！

你需要找到PostgreSQL在F盘的实际安装路径。

---

## 📋 执行这条命令找到正确路径

```powershell
Get-ChildItem -Path "F:\" -Filter "pg_ctl.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
```

或者更简单的方法：

```powershell
dir F:\*pg* /s /b 2>nul | findstr pg_ctl
```

---

## 🎯 常见F盘PostgreSQL路径

PostgreSQL通常会安装在这些位置之一：

```
F:\Program Files\PostgreSQL\17\bin\pg_ctl.exe
F:\PostgreSQL\17\bin\pg_ctl.exe
F:\Apps\PostgreSQL\17\bin\pg_ctl.exe
```

---

## ✅ 快速替换命令

找到路径后，把路径替换进去执行：

**把 `C:\Program Files\PostgreSQL\17` 替换成你找到的实际路径**

例如如果路径是 `F:\Program Files\PostgreSQL\17`：

```powershell
# 初始化数据库
& "F:\Program Files\PostgreSQL\17\bin\initdb.exe" -D "F:\dunhuang-design\postgres" -E UTF8 -U postgres -A md5 -W
```

```powershell
# 启动数据库
& "F:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "F:\dunhuang-design\postgres" -l "F:\dunhuang-design\logs\pg.log" start
```

```powershell
# 创建数据库
& "F:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres dunhuang_design
```

---

## 🔍 或者告诉我

执行上面的搜索命令后，**把找到的路径发给我**，我帮你生成正确的命令！

---

## 📝 快速检查

执行这个命令看看F盘有什么：

```powershell
dir F:\ | findstr -i postgre
```

如果有显示，那就是你的PostgreSQL文件夹！
