# Markdown Master

Markdown Master 是一个为 Obsidian 设计的插件，提供一键式 Markdown 文件格式化功能，并支持自定义格式化规则。

## 功能

- 一键格式化当前打开的 Markdown 文件
- 提供格式化预览
- 支持撤销上一次的格式化操作
- 批量格式化多个文件
- 可配置的格式化规则
- 格式化历史记录
- 自定义正则表达式规则
- 快捷键支持

## 格式化规则

- 删除特定格式的链接
- 将所有二级标题转换为一级标题
- 删除所有粗体标记
- 删除所有数字引用标记
- 确保标题和列表项后有空格
- 删除多余的空行
- 修复有序列表格式
- 应用自定义正则表达式规则

## 使用方法

1. 通过命令面板（Ctrl/Cmd + P）使用以下命令：
   - "Markdown Master: 格式化当前Markdown文件"（快捷键：Ctrl/Cmd + Shift + F）
   - "Markdown Master: 撤销上次格式化"（快捷键：Ctrl/Cmd + Shift + Z）
   - "Markdown Master: 批量格式化所有Markdown文件"
   - "Markdown Master: 显示格式化历史记录"

2. 点击功能区中的铅笔图标来打开格式化选项。

3. 在插件设置中配置格式化规则和添加自定义正则表达式。

## 安装

### 从 Obsidian 社区插件市场安装

1. 打开 Obsidian 设置 > 第三方插件
2. 禁用安全模式
3. 点击浏览社区插件
4. 搜索 "Markdown Master"
5. 点击安装
6. 安装完成后，启用插件

### 从 GitHub 手动安装

1. 下载最新的 release 版本 zip 文件。
2. 解压文件，将文件夹重命名为 `markdown-master`。
3. 将 `markdown-master` 文件夹移动到你的 Obsidian vault 的插件文件夹：`<vault>/.obsidian/plugins/`
4. 重新加载 Obsidian
5. 进入设置 > 第三方插件，启用 "Markdown Master"

## 配置

在 Obsidian 设置中，找到 "Markdown Master" 部分：

1. 启用或禁用特定的格式化规则
2. 添加自定义正则表达式规则（格式：正则表达式|||替换内容）

## 贡献

欢迎提交 Issues 和 Pull Requests 来帮助改进这个插件。

## 许可证

MIT 许可证
