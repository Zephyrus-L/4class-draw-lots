# 4class抽签项目交接说明

## 项目简介

本项目是仅面向 Windows 的轻量级便携版桌面抽签工具，应用名为“4class抽签”，当前版本为 `1.0.0`。程序无需安装，业务数据保存在可执行文件同级的 `data` 目录，复制整个便携版目录即可迁移软件及数据。

GitHub 仓库：https://github.com/Zephyrus-L/4class-draw-lots

产品主要用于课堂、会议等人员随机抽取场景。界面采用简约的黑白灰浅色主题，应用图标为黑底白色几何转盘图形。正式构建为 Tauri Windows GUI 程序，启动时不显示终端窗口。

## 当前功能

- 管理多个名单组，每组具有不可重复的固定编号，如 `001`、`002`。
- 新建、切换、重命名和删除名单组；至少保留一个名单组，名单组管理仅在名单管理页提供。
- 在名单管理页添加、查看和删除参与者。
- 支持勾选、全选和批量删除参与者，并可将选中参与者添加到新名单组。
- 支持导入 TXT、CSV、XLS 和 XLSX 文件。
- 支持配置单次抽取人数。
- 支持抽中后从本轮候选池移除，并可手动重置本轮状态。
- 支持只从名单中的部分参与者抽签。
- 参与者选择区支持点击、鼠标按住拖选和触控拖选。
- 记忆抽取人数、抽中后移除、历史记录开关、当前名单组、当前页面和每个名单组的参与者选择。
- 保存抽签批次、名单组编号、名单组名称、抽中姓名和时间。
- 支持按名单组筛选、批量选择、删除和导出抽签历史记录。
- 支持选择历史导出字段和 CSV、TXT 导出格式。
- 支持按当前历史筛选结果统计姓名抽中次数。
- 支持复制当前抽签结果。
- 抽签时在姓名展示框中快速切换姓名，并逐步减慢切换速度后停止；展示只替换姓名文本，不使用淡化、位移或其他运动效果，动画仅影响展示，不参与随机计算。
- 提供关于页面和 GitHub 项目链接。
- 支持通过本地配置文件调整指定姓名的最终抽取概率。
- 品牌图标和应用名称位于侧边栏顶部，侧边栏固定，只有主内容区滚动。

## 技术架构

### 桌面层

- Tauri 2
- Rust stable，目标平台 `x86_64-pc-windows-msvc`
- `rusqlite`，启用 `bundled` SQLite
- Windows WebView2
- Release 入口通过 `windows_subsystem = "windows"` 隐藏终端窗口

### 前端

- React 18
- Vite 6
- JavaScript ES modules
- Lucide React 图标
- SheetJS `xlsx` 解析 Excel 文件
- 原生 Pointer Events 实现鼠标及触控拖选

### 数据流

前端通过 Tauri `invoke` 调用 Rust 命令：

- `load_data`：从 SQLite 加载应用状态。
- `save_data`：将完整应用状态写入 SQLite。
- `load_probabilities`：读取本地权重配置文件。

浏览器开发预览无法调用 Tauri 命令时，名单和记录回退到 `localStorage`。正式桌面程序以 SQLite 数据为准。

## 关键目录

```text
src/
  main.jsx                 主页面、名单管理、抽签流程和交互
  weightedPick.js          独立的概率选择算法
  styles.css               基础界面样式
  selection.css            名单组、选择区、固定布局和批量管理样式
  theme.css                黑白灰浅色主题覆盖
public/icons/
  app-icon.png             应用内侧边栏图标
src-tauri/
  src/lib.rs               SQLite、文件路径和 Tauri 命令
  src/main.rs              Windows GUI 程序入口
  tauri.conf.json          应用名、版本、窗口和图标配置
  icons/                   Windows 及其他 Tauri 图标资源
test/
  weightedPick.test.mjs    概率抽签确定性测试
scripts/
  构建便携版.bat           Windows 便携版构建脚本
  启动开发版.bat           Windows 开发启动脚本
docs/preview/
  *.png                    界面预览图片
data/probabilities/
  probabilities.txt        开发目录中的权重配置模板
便携版/
  4class抽签.exe           当前 Windows 便携版程序
  data/                    发布程序的本地数据目录
```

## 应用状态结构

前端状态为：

```js
{
  schemaVersion: 2,
  groups: [
    {
      id: "001",
      name: "默认名单",
      people: [
        { id: 1, name: "张三", drawn: false }
      ],
      selectedPersonIds: []
    }
  ],
  draws: [
    {
      id: 1234567890,
      groupId: "001",
      groupName: "默认名单",
      time: "2026/9/8 10:00:00",
      names: ["张三"]
    }
  ],
  settings: {
    count: 1,
    removeDrawn: true,
    recordHistory: true,
    activeGroup: "001",
    tab: "draw"
  }
}
```

Rust 当前将完整状态序列化为 JSON，并存入 SQLite 的单行 `app_data` 表：

```sql
CREATE TABLE app_data (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL
)
```

数据库路径固定为：

```text
<exe 所在目录>/data/draw.sqlite
```

程序必须放在具有写权限的普通目录，避免放入 `Program Files`。

## 权重配置

权重配置属于隐蔽的本地能力。不要在应用界面、普通使用指南、README 或面向一般用户的提示中暴露该功能。后续开发仍需维护其功能，但除非用户明确要求，不要增加界面入口。

正式程序读取：

```text
<exe 所在目录>/data/probabilities/probabilities.txt
```

每行格式：

```text
名单组固定编号-姓名-数值%
```

示例：

```text
001-李四-10%
0-王五-5%
```

规则：

- 固定编号 `0` 对所有名单组生效。
- 具体名单组配置优先于编号 `0` 的通用配置。
- 当前名单中不存在指定姓名时，该配置自然不参与计算。
- 配置数值表示最终概率百分比，不是相对抽取权重。
- 配置概率总和小于 `100%` 时，未配置人员均分剩余概率。
- 配置概率总和达到或超过 `100%` 时，已配置人员按配置值归一化，未配置人员不参与该次分配。
- 大于或等于 `100%` 被特殊处理为强制候选；若存在强制候选，只在强制候选中选择。
- 多人抽签采用不放回抽取。每选出一人后将其从临时候选池移除，下一次选择基于剩余人员重新计算概率。
- 配置文件在应用启动时读取；修改后需要重新启动程序。

概率选择实现位于 `src/weightedPick.js`，不要在 `main.jsx` 中复制另一套算法。

## 抽签行为

- 未手动选择参与者时，当前名单组中的所有可用人员参与抽签。
- 有手动选择时，只从被选中且当前可用的人员中抽签。
- 开启“抽中后移除”时，抽中人员的 `drawn` 设为 `true`。
- 关闭“抽中后移除”时，不改变 `drawn` 状态。
- 单次抽取人数不得超过当前可用候选人数。
- 抽签结束后保留当前手动选择。
- “重置本轮”重置当前名单组的 `drawn` 状态、参与者选择和结果展示。
- 点击姓名结果展示框也可以开始抽签；复制按钮只复制已完成的当前结果。
- 抽签动画开始前先完成概率选择，动画期间不得重新计算或改变抽签结果。

## 开发与验证

安装依赖：

```powershell
npm install
```

前端开发预览：

```powershell
npm run dev
```

前端生产构建：

```powershell
npm run build
```

概率算法测试：

```powershell
npm run test:weights
```

该测试覆盖：

- 通用 `100%` 强制命中。
- 最终概率在确定随机值下的选择边界。
- 具体名单组配置覆盖通用配置。
- 多人抽签移除已选人员后，从剩余池重新计算。

Windows Release 构建需要：

- Rust stable MSVC 工具链
- Visual Studio 2022 Build Tools 的 C++ 工作负载
- Windows SDK
- WebView2 Runtime

在当前机器上可使用：

```powershell
cmd /c 'call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" && set PATH=%USERPROFILE%\.cargo\bin;%PATH% && npm run tauri build'
```

生成文件：

```text
src-tauri/target/release/draw-lottery.exe
```

发布时将其复制为：

```text
便携版/4class抽签.exe
```

同时确保存在：

```text
便携版/data/probabilities/probabilities.txt
```

## 修改约束

- 仅支持 Windows，不要引入 macOS/Linux 发布流程，除非用户明确要求。
- 保持便携版模式，业务数据必须继续保存在 exe 同级 `data` 目录。
- 保持简约黑白灰浅色主题，并让应用内图标与 Windows 程序图标一致。
- 侧边栏必须固定，品牌图标和应用名称位于侧边栏顶部，主内容区独立滚动。
- 不要恢复右上角“本地数据已保存”文字。
- 不要让 Release 程序显示终端窗口。
- 修改抽签算法后必须运行 `npm run test:weights`。
- 修改前端后必须运行 `npm run build`。
- 修改 Rust、Tauri 配置或发布资源后必须重新运行 Tauri Release 构建，并更新 `便携版/4class抽签.exe`；便携版目录不提交打包程序、数据库或本地配置。
- 每次完成版本更新后，交付说明必须提醒用户将变更提交并同步推送至 GitHub。
