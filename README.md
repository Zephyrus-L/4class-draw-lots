# Foclas抽签

Windows 便携版抽签工具，数据保存在程序同级的 `data` 目录。

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

生成的可执行文件位于 `src-tauri/target/release/`。将 exe 和 `data` 目录放在同一便携版目录中即可直接使用；程序首次保存数据时会自动创建：

```text
便携版/
  Foclas抽签.exe
  data/
    draw.sqlite
```

`便携版/data/draw.sqlite` 保存名单、抽签状态和历史记录。整个 `便携版` 目录可以复制到另一台 Windows 电脑。
