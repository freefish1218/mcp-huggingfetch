# MCP HuggingFace 下载工具

通过 MCP 协议快速下载 HuggingFace 模型的工具，支持 Claude Desktop、Claude Code、Cursor、VS Code 等客户端。

## 📋 快速配置

### Claude Desktop

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "huggingfetch": {
      "command": "npx",
      "args": ["--yes", "freefish1218/mcp-huggingfetch"],
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
      "args": ["--yes", "freefish1218/mcp-huggingfetch"],
      "env": {
        "HUGGINGFACE_TOKEN": "your_token_here",
        "HUGGINGFETCH_DOWNLOAD_DIR": "./models"
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
      "args": ["--yes", "freefish1218/mcp-huggingfetch"],
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

配置完成后，直接在对话中请求下载模型：

```
请帮我下载 ChatTTS 模型到 ./models 目录
```

```  
下载 microsoft/DialoGPT-medium 模型，只要 .bin 文件
```

```
下载 openai/whisper-large-v3 模型，排除测试文件
```

## 📝 支持的下载选项

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `repo_id` | string | HuggingFace 仓库 ID | `"2Noise/ChatTTS"` |
| `download_dir` | string | 下载目录 | `"./models"` |
| `files` | array | 指定文件列表 | `["model.bin", "config.json"]` |
| `file_types` | array | 文件类型过滤 | `[".pt", ".bin", ".safetensors"]` |
| `include_pattern` | string/array | 包含模式 | `"*.json"` 或 `["*.pt", "*.bin"]` |
| `exclude_pattern` | string/array | 排除模式 | `"test_*"` 或 `["*.onnx", "test_*"]` |
| `max_file_size` | string | 最大文件大小 | `"500MB"`, `"1GB"` |
| `min_file_size` | string | 最小文件大小 | `"1KB"`, `"10MB"` |
| `revision` | string | Git 分支/标签 | `"main"`, `"v1.0"` |

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

## 📖 项目地址

- GitHub: [freefish1218/mcp-huggingfetch](https://github.com/freefish1218/mcp-huggingfetch)
- 问题反馈: [Issues](https://github.com/freefish1218/mcp-huggingfetch/issues)