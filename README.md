# 抽签台

Windows 绿色版抽签工具，数据保存在程序同级的 `data` 目录。

## 开发预览

```powershell
npm install
npm run dev
```

## 构建 Windows 程序

先安装 Rust stable、Visual Studio Build Tools（Desktop development with C++）和 WebView2 Runtime，然后执行：

```powershell
npm install
npm run tauri build
```

生成的可执行文件位于 `src-tauri/target/release/`。将 exe 复制到一个普通可写目录后即可作为绿色版使用；程序首次保存数据时会自动创建：

```text
抽签台.exe
data/
  draw.sqlite
```

`data/draw.sqlite` 保存名单、抽签状态和历史记录。整个目录可以复制到另一台 Windows 电脑。
