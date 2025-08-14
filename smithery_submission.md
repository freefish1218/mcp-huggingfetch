# Smithery Submission for mcp-huggingfetch

## 📦 Package Information

**Name**: mcp-huggingfetch  
**Version**: 1.0.0  
**Description**: High-speed HuggingFace model downloader MCP server with concurrent downloads, resume support, and smart filtering  
**Repository**: https://github.com/freefish1218/mcp-huggingfetch  
**npm**: https://www.npmjs.com/package/mcp-huggingfetch

## 🎯 Key Features

- ⚡ **3-5x faster downloads** with concurrent streaming
- 🔄 **Automatic resume** on network failures
- 🎯 **Smart filtering** with glob patterns and size constraints
- 📊 **Real-time progress** tracking
- 🛠 **Pure Node.js** - no Python dependencies

## 🔧 Installation

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

## 📋 Supported Tools

### `download_huggingface_model`
Downloads HuggingFace models with advanced filtering options:
- Pattern-based file selection
- Size constraints
- File type filtering
- Resume capability

### `list_huggingface_files`
Lists repository files with:
- Path navigation
- Pattern matching
- Size/name/type sorting

## 💡 Usage Examples

```
"Download ChatTTS model to ./models directory"
"List all safetensors files in meta-llama/Llama-3.2-1B"
"Download whisper-large-v3, exclude test files"
```

## 🏷️ Tags

#mcp #huggingface #model-download #ai-tools #machine-learning

## 📊 Statistics

- Weekly downloads: New package
- GitHub stars: To be tracked
- Active maintenance: Yes
- License: MIT

## 🔗 Submission URL

Submit at: https://smithery.ai/submit