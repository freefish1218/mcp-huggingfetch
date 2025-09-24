# MCP HuggingFace Fast Download Tool

[![npm version](https://badge.fury.io/js/mcp-huggingfetch.svg)](https://www.npmjs.com/package/mcp-huggingfetch)
[![npm downloads](https://img.shields.io/npm/dm/mcp-huggingfetch.svg)](https://www.npmjs.com/package/mcp-huggingfetch)

⚡ High-speed HuggingFace model downloads with concurrent downloading, resume support, and intelligent retry - 3-5x faster than traditional methods. Supports Claude Desktop, Claude Code, Cursor, VS Code, and other clients.

<a href="https://glama.ai/mcp/servers/@freefish1218/mcp-huggingfetch">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@freefish1218/mcp-huggingfetch/badge" alt="HuggingFetch MCP server" />
</a>

[中文版](README_zh.md) | [日本語](README_ja.md) | [Français](README_fr.md) | [Deutsch](README_de.md)

## 📋 Quick Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

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

Add to `.claude/claude_config.json`:

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

### Cursor / VS Code (Continue Extension)

Add to `config.json`:

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

## 🔑 Get HuggingFace Token

1. Visit [HuggingFace Settings](https://huggingface.co/settings/tokens)
2. Create a new Access Token
3. Copy the token to `HUGGINGFACE_TOKEN` in the above configuration

## 🛠 Usage

After configuration, use the following features directly in conversations:

### 📋 List Files

View and filter repository files:

```
List JSON files in the 2Noise/ChatTTS repository
```

### 🔍 Explore Repository

Understand repository structure:

```
Explore the directory structure of microsoft/DialoGPT-medium
```

### 🔎 Search Files

Find specific files by name:

```
Search for config files in openai/whisper-large-v3
```

### 📥 Download Models

Selectively download required files:

```
Please download the ChatTTS model to ./models directory
```

```  
Download microsoft/DialoGPT-medium model, only .bin files
```

```
Download openai/whisper-large-v3 model, exclude test files
```

## 📝 Available Tools

### File Listing (`list_huggingface_files`)

List and filter repository files with pattern matching and sorting.

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `repo_id` | string | HuggingFace repository ID | - |
| `revision` | string | Git branch/tag | `"main"` |
| `pattern` | string | File filter pattern (glob) | - |
| `exclude` | string | Exclusion pattern | - |
| `max_files` | number | Maximum files to return | `100` |
| `sort` | string | Sort by: `name`, `size`, `type` | `"name"` |

### Repository Explorer (`explore_huggingface_repo`)

Explore repository structure and get hierarchical file tree.

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `repo_id` | string | HuggingFace repository ID | - |
| `revision` | string | Git branch/tag | `"main"` |
| `max_depth` | number | Maximum scan depth | `3` |
| `tree_view` | boolean | Generate ASCII tree view | `false` |

### File Search (`search_huggingface_files`)

Search files by name or pattern within repository.

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `repo_id` | string | HuggingFace repository ID | - |
| `query` | string | Search keyword or pattern | - |
| `revision` | string | Git branch/tag | `"main"` |
| `max_results` | number | Maximum results to return | `50` |

### Download Tool Options (`download_huggingface_model`)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `repo_id` | string | HuggingFace repository ID | `"2Noise/ChatTTS"` |
| `download_dir` | string | Download directory | `"./models"` |
| `files` | array | Specific file list | `["model.bin", "config.json"]` |
| `allow_patterns` | string/array | Include patterns | `"*.json"` or `["*.pt", "*.bin"]` |
| `ignore_patterns` | string/array | Exclude patterns | `"test_*"` or `["*.onnx", "test_*"]` |
| `revision` | string | Git branch/tag | `"main"`, `"v1.0"` |
| `force_redownload` | boolean | Force re-download | `true`, `false` |

## 🔧 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HUGGINGFACE_TOKEN` | ✅ | - | HuggingFace access token |
| `HUGGINGFETCH_DOWNLOAD_DIR` | ❌ | `~/Downloads/huggingface_models` | Default download directory |
| `HF_HOME` | ❌ | `~/.cache/huggingface` | Cache directory |
| `LOG_LEVEL` | ❌ | `info` | Log level (`debug`, `info`, `warn`, `error`) |

## ❓ FAQ

**Q: Token authentication failed, what should I do?**  
A: Check if `HUGGINGFACE_TOKEN` is correctly set, ensure the token is valid and has sufficient permissions.

**Q: Download speed is slow, what can I do?**  
A: The tool supports resume downloads and concurrent downloading. Network issues may cause slow speeds, automatic retry will occur.

**Q: How to download private models?**  
A: Ensure your HuggingFace account has access permissions and use a valid token.

**Q: What file formats are supported?**  
A: All file formats on HuggingFace are supported, including `.pt`, `.bin`, `.safetensors`, `.json`, `.txt`, etc.

## 🏗 Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/freefish1218/mcp-huggingfetch.git
cd mcp-huggingfetch
npm install
```

### Development Commands

```bash
npm run dev          # Run with file watching
npm start           # Run the MCP server
npm run test:basic  # Run basic functionality tests
npm test            # Run Jest unit tests
npm run lint        # Check code style
npm run lint:fix    # Auto-fix linting issues
```

### Release Commands

```bash
npm run release:patch  # Release patch version (1.0.0 -> 1.0.1)
npm run release:minor  # Release minor version (1.0.0 -> 1.1.0)
npm run release:major  # Release major version (1.0.0 -> 2.0.0)
```

The release scripts will automatically:
- Run tests and linting
- Update version number
- Create git tag
- Push to GitHub
- Publish to npm

For more details, see [Release Guide](docs/RELEASE.md)

### Building

```bash
npm run build       # Build single binary
npm run build:all   # Build for all platforms (Linux, macOS, Windows)
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 📖 Links

- GitHub: [freefish1218/mcp-huggingfetch](https://github.com/freefish1218/mcp-huggingfetch)
- Issues: [Report Issues](https://github.com/freefish1218/mcp-huggingfetch/issues)
- NPM: [mcp-huggingfetch](https://www.npmjs.com/package/mcp-huggingfetch)

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.