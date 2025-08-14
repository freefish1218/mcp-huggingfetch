# Release v1.0.0 - 稳定版

## 🎉 主要特性

### ⚡ 高速下载能力
- **并发下载**: 自动优化下载速度，比传统方式快 3-5 倍
- **断点续传**: 网络中断后自动恢复下载
- **智能重试**: 自动处理网络错误和临时故障

### 🔍 智能文件筛选
- **多模式匹配**: 支持同时使用多个包含/排除模式
- **文件大小过滤**: 按大小筛选需要的文件
- **文件类型过滤**: 快速下载特定类型的模型文件

### 🛠 易于集成
- **MCP 标准协议**: 完全兼容 Claude Desktop、Claude Code、Cursor、VS Code
- **纯 Node.js 实现**: 无需 Python 或其他依赖
- **简单配置**: 通过 npx 一键运行

## 📋 快速开始

```bash
# 通过 npx 直接使用（无需安装）
npx mcp-huggingfetch@latest

# 或全局安装
npm install -g mcp-huggingfetch
```

## 🔧 配置示例

在 Claude Desktop 的 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "huggingfetch": {
      "command": "npx",
      "args": ["-y", "mcp-huggingfetch@latest"],
      "env": {
        "HUGGINGFACE_TOKEN": "your_token_here"
      }
    }
  }
}
```

## 💡 使用示例

```
# 列出模型文件
"列出 ChatTTS 模型的所有文件"

# 下载模型
"下载 microsoft/DialoGPT-medium 模型，只要 .bin 文件"

# 选择性下载
"下载 openai/whisper-large-v3，排除测试文件"
```

## 📊 性能提升

- 下载 ChatTTS 模型（~2GB）: **6分钟** vs 传统方式 20分钟
- 下载 Whisper Large v3（~1.5GB）: **4分钟** vs 传统方式 15分钟
- 支持断点续传，网络中断后无需重新开始

## 🙏 致谢

感谢所有贡献者和早期用户的反馈！

## 📖 文档

- [GitHub 仓库](https://github.com/freefish1218/mcp-huggingfetch)
- [问题反馈](https://github.com/freefish1218/mcp-huggingfetch/issues)
- [npm 包](https://www.npmjs.com/package/mcp-huggingfetch)