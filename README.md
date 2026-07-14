<div align="center">

# 轻量提醒

一个面向项目经理和高频协作者的 Windows 桌面任务捕捉工具。

快速记录，桌面可见，到点提醒，本地保存。

![Electron](https://img.shields.io/badge/Electron-31.7.7-47848F?logo=electron&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-原生-F7DF1E?logo=javascript&logoColor=111)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D4?logo=windows&logoColor=white)
![Storage](https://img.shields.io/badge/Storage-Local_JSON-4B5563)

</div>

## 项目简介

轻量提醒是一个常驻桌面的轻量任务便签，适合把聊天、会议、邮件、文档、网页里临时出现的待办快速收集起来。

它不是完整项目管理系统，不做多人协作、权限、看板、甘特图或云同步。它专注三件事：

| 目标 | 说明 |
| --- | --- |
| 快速收集 | 手动输入、剪贴板、选中文字、图片都能快速变成任务 |
| 持续可见 | 桌面浮窗常驻，支持置顶、透明度和折叠 |
| 到点提醒 | 系统通知 + 应用内提醒面板，避免任务被忘掉 |

## 功能亮点

- 桌面浮窗任务面板，任务默认紧凑显示，操作可按需展开
- 支持隐藏、折叠、置顶和透明度设置
- 本地 JSON 保存任务、分组、设置和图片附件
- 任务新增、编辑、完成、删除、置顶、清理已完成
- 任务分组、重命名、删除，删除分组时任务自动回到收集箱
- PM 状态标记：待处理、等反馈、风险
- 提醒时间编辑、清除、逾期筛选和逾期高亮
- 到期后触发 Windows 系统通知、提示音和应用内提醒面板
- 精确定时、定期兜底扫描，并在系统休眠恢复后补查提醒
- 设置页可测试 Windows 通知并直接打开系统通知设置
- 从剪贴板文本、选中文字、文件图片、剪贴板图片创建任务
- 给已有任务追加图片附件
- 托盘菜单、全局快捷键、开机启动设置

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 桌面框架 | Electron |
| 主进程 | Node.js CommonJS |
| 渲染层 | 原生 HTML / CSS / JavaScript |
| 数据存储 | 本地 JSON 文件 |
| 打包 | electron-builder |

当前项目没有 React、Vue、Vite、Webpack 或 TypeScript 构建链，结构很轻，适合快速迭代。

## 快速开始

安装依赖：

```bash
npm install
```

启动应用：

```bash
npm start
```

如果 PowerShell 禁止运行 `npm.ps1`，使用：

```bash
npm.cmd install
npm.cmd start
```

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm.cmd start` | 开发运行 |
| `npm.cmd test` | 运行时间解析测试 |
| `npm.cmd run dist` | 打包 Windows portable exe |
| `npm.cmd run pack:win` | 打包 Windows 文件夹版 |

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Alt + Space` | 呼出快速输入 |
| `Ctrl + Alt + T` | 从剪贴板创建任务 |
| `Ctrl + Alt + R` | 显示 / 隐藏任务面板 |

在设置中启用“快捷键自动复制选中文字”后，`Ctrl + Alt + T` 会先尝试复制当前选区，再创建任务。默认会恢复原剪贴板，减少对日常复制粘贴的影响。

## 数据位置

应用固定使用 `%APPDATA%\light-reminder-desktop` 作为用户数据目录。

| 文件 / 目录 | 内容 |
| --- | --- |
| `tasks.json` | 任务数据 |
| `groups.json` | 分组数据 |
| `settings.json` | 应用设置 |
| `attachments\` | 图片附件 |
| `app.log` | 启动、窗口加载、渲染异常等日志 |

图片会被复制到 `attachments` 目录，任务 JSON 只保存图片路径和预览 URL。

## 项目结构

```text
src/
  main/
    main.js       # Electron 主进程：窗口、托盘、快捷键、数据、提醒、IPC
    reminderParser.js # 中文自然语言提醒时间解析
    preload.js    # 安全暴露给渲染层的 reminderApi
  renderer/
    index.html    # 应用 DOM 结构
    app.js        # 渲染层状态、列表渲染和交互
    styles.css    # 样式
build/            # 图标资源
release/          # electron-builder 输出产物
```

## 开发说明

当前已有提醒时间解析单元测试，但仍没有 lint 或格式化脚本。修改功能后建议先运行 `npm.cmd test`，并至少手动验证：

- 应用能正常启动
- 可以新增、编辑、完成、删除任务
- 提醒时间和逾期提醒正常
- 快捷键可用
- 图片附件可添加和打开
- 设置保存后重启仍生效

更完整的维护说明见 [轻量化提醒应用项目文档.md](./轻量化提醒应用项目文档.md)。
