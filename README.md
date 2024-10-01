# Markdown Master

Markdown Master 是一个为 Obsidian 设计的插件，旨在提供一键式 Markdown 文件格式化功能。

## 功能特点

- 一键格式化当前打开的 Markdown 文件
- 提供格式化预览，让您在应用更改前查看效果
- 支持撤销上一次的格式化操作
- 提供测试功能，让您了解格式化的效果

## 安装

### 从 GitHub 安装（手动安装）

1. 前往本插件的 GitHub 仓库 [Releases](https://github.com/您的用户名/markdown-master/releases) 页面。
2. 下载最新版本的发布包（通常是一个 zip 文件）。
3. 解压下载的文件。
4. 将解压后的文件夹复制到您的 Obsidian 插件文件夹中：
   - 在 Obsidian 中，点击设置 -> 第三方插件
   - 点击文件夹图标，打开插件文件夹
   - 将解压后的文件夹复制到这个位置
5. 在 Obsidian 中，进入设置 -> 第三方插件
6. 刷新插件列表
7. 找到 "Markdown Master" 插件并启用它

### 从 Obsidian 社区插件市场安装（如果已上架）

1. 打开 Obsidian 设置
2. 进入 "第三方插件" 选项卡
3. 确保 "安全模式" 已关闭
4. 点击 "浏览社区插件"
5. 搜索 "Markdown Master"
6. 点击 "安装"
7. 安装完成后，启用插件

## 使用方法

### 通过命令面板

1. 打开命令面板 (Ctrl/Cmd + P)
2. 搜索并选择以下命令之一:
   - "Markdown Master: 格式化当前Markdown文件"
   - "Markdown Master: 撤销上次格式化"
   - "Markdown Master: 测试Markdown格式化"

### 通过功能区图标

点击功能区中的铅笔图标来打开格式化选项。

## 格式化规则

当前版本包含以下格式化规则:

- 确保标题符号 (#) 后有空格
- 确保列表项符号 (-) 后有空格
- 删除多余的空行，保留最多两个连续的空行
- 将二级标题 (##) 转换为一级标题 (#)
- 移除所有粗体标记 (**)
- 移除所有引用标记 ([数字])
- 修复有序列表的格式（确保数字后有空格）
- 移除文档开头和结尾的空白字符

请注意，某些规则（如移除粗体标记和引用标记）可能会改变文档的语义。使用时请谨慎，并在应用更改前仔细检查预览结果。

## 配置

目前，插件不提供额外的配置选项。所有功能都是开箱即用的。

## 贡献

欢迎提交 Issues 和 Pull Requests 来帮助改进这个插件。

## 许可证

本项目采用 MIT 许可证。详情请见 [LICENSE](LICENSE) 文件。

## 作者

[您的名字]

## 致谢

感谢 Obsidian 社区的支持和反馈。

## 开发者注意事项

### 自动化发布流程

本项目使用 GitHub Actions 进行自动化打包和发布。以下是发布新版本的步骤：

1. 在本地进行代码修改和测试。
2. 更新 `package.json` 中的版本号。
3. 提交您的更改并推送到 GitHub。
4. 创建一个新的 tag，与 `package.json` 中的版本号相匹配：
   ```bash
   git tag -a v1.0.1 -m "Release version 1.0.1"
   git push origin v1.0.1
   ```
5. GitHub Actions 将自动构建项目并创建一个新的 release draft。
6. 检查 release draft，如果一切正常，发布该 release。

注意：确保在推送新的 tag 之前，所有更改都已经提交并推送到 GitHub。
