# MCP HuggingFace 高速下载工具

[![npm version](https://badge.fury.io/js/mcp-huggingfetch.svg)](https://www.npmjs.com/package/mcp-huggingfetch)
[![Tests](https://github.com/freefish1218/mcp-huggingfetch/actions/workflows/test.yml/badge.svg)](https://github.com/freefish1218/mcp-huggingfetch/actions/workflows/test.yml)
[![npm downloads](https://img.shields.io/npm/dm/mcp-huggingfetch.svg)](https://www.npmjs.com/package/mcp-huggingfetch)

⚡ 高速下载 HuggingFace 模型到本地 - 支持并发下载、断点续传、智能重试，比传统方式快3-5倍。支持 Claude Desktop、Claude Code、Cursor、VS Code 等客户端。

<a href="https://glama.ai/mcp/servers/@freefish1218/mcp-huggingfetch">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@freefish1218/mcp-huggingfetch/badge" alt="HuggingFetch MCP server" />
</a>

[English](README.md) | [日本語](README_ja.md) | [Français](README_fr.md) | [Deutsch](README_de.md)

## 📋 快速配置

### Claude Desktop

在 `claude_desktop_config.json` 中添加：

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

### Claude Code

在 `.claude/claude_config.json` 中添加：

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

### Cursor / VS Code (Continue 插件)

在 `config.json` 中添加：

```json
{
  "mcp": [
    {
      "name": "huggingfetch",
      "command": "npx",
      "args": ["-y", "mcp-huggingfetch@latest"],
      "env": {
        "HUGGINGFACE_TOKEN": "your_token_here"
      }
    }
  ]
}
```

## 🔑 获取 HuggingFace Token

1. 访问 [HuggingFace Settings](https://huggingface.co/settings/tokens)
2. 创建新的 Access Token
3. 将 token 复制到上述配置中的 `HUGGINGFACE_TOKEN`

## 🛠 使用方法

配置完成后，直接在对话中使用以下功能：

### 📋 查看文件列表

在下载前先查看仓库中的文件：

```
列出 2Noise/ChatTTS 仓库的所有文件
```

```
查看 bert-base-uncased 仓库中的 JSON 文件
```

```
显示 openai/whisper-large-v3 按大小排序的文件列表
```

### 📥 下载模型

选择性下载所需文件：

```
请帮我下载 ChatTTS 模型到 ./models 目录
```

```  
下载 microsoft/DialoGPT-medium 模型，只要 .bin 文件
```

```
下载 openai/whisper-large-v3 模型，排除测试文件
```

## 📝 支持的功能

### 列表工具选项 (`list_huggingface_files`)

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `repo_id` | string | HuggingFace 仓库 ID | `"2Noise/ChatTTS"` |
| `revision` | string | Git 分支/标签 | `"main"`, `"v1.0"` |
| `path` | string | 仓库内子路径 | `"models/"` |
| `pattern` | string | 文件名过滤模式 | `"*.json"`, `"*.safetensors"` |
| `sort_by` | string | 排序方式 | `"size"`, `"name"`, `"type"` |

### 下载工具选项 (`download_huggingface_model`)

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `repo_id` | string | HuggingFace 仓库 ID | `"2Noise/ChatTTS"` |
| `download_dir` | string | 下载目录 | `"./models"` |
| `files` | array | 指定文件列表 | `["model.bin", "config.json"]` |
| `allow_patterns` | string/array | 包含模式 | `"*.json"` 或 `["*.pt", "*.bin"]` |
| `ignore_patterns` | string/array | 排除模式 | `"test_*"` 或 `["*.onnx", "test_*"]` |
| `revision` | string | Git 分支/标签 | `"main"`, `"v1.0"` |
| `force_redownload` | boolean | 强制重新下载 | `true`, `false` |

## 🔧 环境变量配置

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `HUGGINGFACE_TOKEN` | ✅ | - | HuggingFace 访问令牌 |
| `HUGGINGFETCH_DOWNLOAD_DIR` | ❌ | `~/Downloads/huggingface_models` | 默认下载目录 |
| `HF_HOME` | ❌ | `~/.cache/huggingface` | 缓存目录 |
| `LOG_LEVEL` | ❌ | `info` | 日志级别 (`debug`, `info`, `warn`, `error`) |

## ❓ 常见问题

**Q: Token 认证失败怎么办？**  
A: 检查 `HUGGINGFACE_TOKEN` 是否正确设置，确保 token 有效且有足够权限。

**Q: 下载速度慢怎么办？**  
A: 工具支持断点续传和并发下载，网络问题可能导致速度慢，会自动重试。

**Q: 如何下载私有模型？**  
A: 确保您的 HuggingFace 账户有访问权限，并使用有效的 token。

**Q: 支持哪些文件格式？**  
A: 支持所有 HuggingFace 上的文件格式，包括 `.pt`, `.bin`, `.safetensors`, `.json`, `.txt` 等。

## 🏗 开发

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装

```bash
git clone https://github.com/freefish1218/mcp-huggingfetch.git
cd mcp-huggingfetch
npm install
```

### 开发命令

```bash
npm run dev          # 运行并监视文件变化
npm start           # 运行 MCP 服务器
npm run test:basic  # 运行基础功能测试
npm test            # 运行 Jest 单元测试
npm run lint        # 检查代码风格
npm run lint:fix    # 自动修复代码风格问题
```

### 构建

```bash
npm run build       # 构建单个二进制文件
npm run build:all   # 为所有平台构建 (Linux, macOS, Windows)
```

## 📄 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 📖 项目地址

- GitHub: [freefish1218/mcp-huggingfetch](https://github.com/freefish1218/mcp-huggingfetch)
- 问题反馈: [Issues](https://github.com/freefish1218/mcp-huggingfetch/issues)
- NPM: [mcp-huggingfetch](https://www.npmjs.com/package/mcp-huggingfetch)

## 🤝 贡献

欢迎贡献！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。