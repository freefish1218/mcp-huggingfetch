# 故障排查指南

## Claude Code 连接问题

### 问题：Failed to reconnect to huggingfetch

这是最常见的连接问题，可能有以下几种原因：

#### 1. 快速诊断

运行诊断工具检查 MCP 服务器是否正常工作：

```bash
npm run test:diagnose
```

如果显示 "✅ MCP 服务器工作正常！"，说明服务器本身没有问题，继续下面的步骤。

#### 2. 配置文件位置问题

Claude Code 需要在项目根目录的 `.claude/claude_config.json` 中配置 MCP 服务器。

**自动配置：**
```bash
npm run setup:claude
```

**手动检查配置位置：**
```bash
# 查看配置文件是否存在
ls -la .claude/claude_config.json

# 查看配置内容
cat .claude/claude_config.json
```

#### 3. 配置格式问题

确保配置文件格式正确：

```json
{
  "mcpServers": {
    "huggingfetch": {
      "command": "npx",
      "args": ["-y", "mcp-huggingfetch@latest"],
      "env": {
        "HUGGINGFACE_TOKEN": "your_actual_token_here",
        "HUGGINGFETCH_DOWNLOAD_DIR": "./models"
      }
    }
  }
}
```

**注意事项：**
- `HUGGINGFACE_TOKEN` 必须是有效的 token
- 不要遗漏引号或逗号
- JSON 格式必须严格正确

#### 4. Token 认证问题

**检查 Token 是否设置：**
```bash
echo $HUGGINGFACE_TOKEN
```

**获取新 Token：**
1. 访问 [HuggingFace Settings](https://huggingface.co/settings/tokens)
2. 创建新的 Access Token（选择 "Read" 权限即可）
3. 复制 token 并替换配置中的 `your_actual_token_here`

#### 5. Claude Code 重启问题

修改配置后必须重启 Claude Code：
1. 完全退出 Claude Code（Cmd+Q 或 关闭所有窗口）
2. 重新打开 Claude Code
3. 输入 `/mcp` 检查是否显示 "huggingfetch"

#### 6. 查看详细日志

**MCP 服务器日志：**
```bash
# macOS/Linux
cat /tmp/mcp-huggingfetch.log

# 或查看配置中指定的日志文件
cat $(grep MCP_LOG_FILE .claude/claude_config.json | cut -d'"' -f4)
```

**Claude Code 日志：**
1. 在 Claude Code 中输入 `/debug`
2. 查看 MCP 连接相关的错误信息

#### 7. 本地开发环境特殊配置

如果你在开发 mcp-huggingfetch 本身，使用本地路径配置：

```json
{
  "mcpServers": {
    "huggingfetch": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-huggingfetch/bin/cli.js"],
      "env": {
        "HUGGINGFACE_TOKEN": "your_token",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### 问题：MCP 服务器启动失败

#### 症状
- 诊断工具显示 "❌ MCP 服务器存在问题"
- 日志显示 "Server startup failed"

#### 解决方案

1. **检查 Node.js 版本：**
```bash
node --version  # 需要 >= 18.0.0
```

2. **安装依赖：**
```bash
npm install
```

3. **检查文件权限：**
```bash
chmod +x bin/cli.js
```

4. **测试直接运行：**
```bash
node bin/cli.js
# 输入以下 JSON 测试：
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0.0","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
```

### 问题：下载失败

#### 401 Unauthorized
- Token 无效或过期
- 尝试访问私有模型但没有权限

#### 429 Too Many Requests
- API 请求频率限制
- 等待几分钟后重试

#### Network Error
- 检查网络连接
- 检查代理设置（如果使用公司网络）

## 常用命令

### 诊断命令
```bash
# 运行完整诊断
npm run test:diagnose

# 设置 Claude Code 配置
npm run setup:claude

# 查看日志
cat /tmp/mcp-huggingfetch.log

# 测试基本功能
npm run test:basic

# 检查代码规范
npm run lint
```

### 清理和重置
```bash
# 删除配置重新开始
rm -rf .claude/claude_config.json

# 清理日志
rm -f /tmp/mcp-huggingfetch.log

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

## 获取帮助

如果以上方法都无法解决问题：

1. 运行诊断工具并保存输出
2. 查看日志文件
3. 在 [GitHub Issues](https://github.com/freefish1218/mcp-huggingfetch/issues) 提交问题，包含：
   - 诊断工具输出
   - 错误日志
   - 你的配置文件（隐藏 token）
   - Node.js 版本
   - 操作系统信息