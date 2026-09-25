# 4class抽签

当前版本：`1.0.2`

## 品牌与应用

`4class` 是本项目的品牌名，`4` 为 `for` 的谐音，意为“为课堂设计”的系列软件。本应用名称为“抽签”，组合名称为“4class抽签”。项目专为课堂服务。

本项目是 Windows 便携版课堂抽签工具，数据保存在程序同级的 `data` 目录。

GitHub 仓库：https://github.com/Zephyrus-L/4class-draw-lots

本项目采用 MIT License，详见 `LICENSE`。

应用名称为 `4class抽签`，关于页面显示当前版本，并可调用系统默认浏览器打开 GitHub 项目。

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

生成的可执行文件位于 `src-tauri/target/release/draw-lottery.exe`。将 exe 重命名为 `4class.exe`，与 `data` 目录放在同一便携版目录中即可直接使用；程序首次保存数据时会自动创建：

```text
打包的测试用软件/
  4class.exe
  data/
    draw.sqlite
```

`打包的测试用软件/data/draw.sqlite` 保存名单、抽签状态和历史记录。整个“打包的测试用软件”目录可以复制到另一台 Windows 电脑。

## 工作区架构

```text
工作区/
├─ 软件源代码/
└─ 打包的测试用软件/
```

当前仓库以根目录作为软件源代码目录，以 `打包的测试用软件/` 作为完成打包的测试用软件目录。

## 项目结构

```text
src/                 前端源码
public/              前端静态资源
src-tauri/            Tauri 和 Rust 桌面层
scripts/              开发与便携版构建脚本
docs/preview/         界面预览图
data/probabilities/   开发配置模板
打包的测试用软件/      完成打包的测试用软件
```

每次修改都要同步至 `AGENTS.md` 和 `README.md`。
