# 轻量提醒

轻量提醒是一个 Windows 桌面端任务捕捉和提醒工具，面向项目经理、产品经理、运营负责人等需要频繁记录零碎待办的人。它不是完整项目管理系统，而是一个常驻桌面的轻量任务便签：快速记录、即时可见、到点提醒、本地保存。

当前项目是 Electron 应用，渲染层使用原生 HTML/CSS/JavaScript，没有 React/Vue 构建链。

## 当前能力

- 桌面浮窗任务面板，支持隐藏、折叠、置顶和透明度设置
- 本地 JSON 存储任务、分组和设置
- 新增、完成、编辑、删除、置顶、清理已完成任务
- 任务分组、分组切换、重命名、删除，删除分组时任务移回收集箱
- PM 状态标记：待处理、等反馈、风险
- 任务提醒时间编辑、清除、逾期筛选和逾期高亮
- 到点系统通知和应用内提醒面板
- 从剪贴板文本、选中文字、文件图片、剪贴板图片创建任务
- 给已有任务追加图片附件
- 托盘菜单和全局快捷键
- 开机启动、快捷键、剪贴板行为等设置

## 运行

```bash
npm install
npm start
```

如果 PowerShell 禁止运行 `npm.ps1`，使用：

```bash
npm.cmd install
npm.cmd start
```

## 常用命令

```bash
npm.cmd start       # 开发运行
npm.cmd run dist    # 打包 Windows portable exe
npm.cmd run pack:win # 打包 Windows 文件夹版
```

当前没有自动化测试、lint 或格式化脚本。修改功能后建议至少手动跑一遍核心流程：启动、增删改任务、提醒、快捷键、图片附件、设置保存。

## 快捷键

- `Ctrl + Alt + Space`：呼出快速输入
- `Ctrl + Alt + T`：从剪贴板创建任务，启用“自动复制选中文字”后会先复制当前选区
- `Ctrl + Alt + R`：显示 / 隐藏任务面板

快捷键可在设置页修改。若注册失败，通常是被其他软件占用。

## 数据位置

应用固定使用 `%APPDATA%\light-reminder-desktop` 作为用户数据目录：

- `tasks.json`：任务
- `groups.json`：分组
- `settings.json`：设置
- `attachments\`：图片附件
- `app.log`：启动、窗口加载、渲染异常等日志

图片附件会被复制到 `attachments` 目录，任务 JSON 只保存路径和预览 URL。

## 项目结构

```text
src/
  main/
    main.js       # Electron 主进程：窗口、托盘、快捷键、数据、提醒、IPC
    preload.js    # 安全暴露给渲染层的 reminderApi
  renderer/
    index.html    # 应用 DOM 结构
    app.js        # 渲染层状态、列表渲染和交互
    styles.css    # 样式
build/            # 图标资源
release/          # electron-builder 输出产物
```

更完整的维护说明见 [轻量化提醒应用项目文档.md](./轻量化提醒应用项目文档.md)。
