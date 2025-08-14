# Claude Code MCP 连接故障排除指南

## 问题现象
Claude Code 显示 "Failed to reconnect to huggingfetch"，尽管最新版本 0.5.3 已发布并修复了兼容性问题。

## 已确认的信息
✅ npm 包 0.5.3 已成功发布  
✅ 远程包能够正常响应 JSON-RPC 请求  
✅ stderr 输出已优化（生产环境下几乎为零）  
✅ 环境变量兼容性已修复  

## 可能的原因和解决方案

### 1. Claude Code 缓存问题 🔄
**原因**: Claude Code 可能缓存了旧版本的连接状态或配置

**解决方案**:
```bash
# 重启 Claude Code 会话
claude exit
# 重新启动并尝试重新连接
claude mcp list
```

### 2. NPX 缓存问题 📦
**原因**: npx 可能缓存了旧版本的包

**解决方案**:
```bash
# 清除 npx 缓存
npm cache clean --force
npx clear-npx-cache  # 如果存在
```

### 3. MCP 配置问题 ⚙️
**原因**: 配置文件中的命令可能不正确

**检查配置**:
```json
{
  "huggingfetch": {
    "command": "npx",
    "args": ["-y", "mcp-huggingfetch@latest"]
  }
}
```

**或者尝试明确指定版本**:
```json
{
  "huggingfetch": {
    "command": "npx", 
    "args": ["-y", "mcp-huggingfetch@0.5.3"]
  }
}
```

### 4. 权限和环境问题 🔐
**原因**: Claude Code 运行环境可能缺少必要的权限或环境变量

**解决方案**:
```bash
# 确保 Node.js 和 npm 可用
node --version
npm --version

# 检查网络连接
ping registry.npmjs.org
```

### 5. Windows 特定问题 🪟
如果在 Windows 上，参考官方文档的建议：

**解决方案**:
```json
{
  "huggingfetch": {
    "command": "cmd",
    "args": ["/c", "npx", "-y", "mcp-huggingfetch@latest"]
  }
}
```

### 6. 重置 MCP 连接 🔄
**完全重置方法**:

1. 从 MCP 配置中移除 huggingfetch
2. 运行 `claude mcp list` 确认已移除
3. 重新添加:
   ```bash
   claude mcp add huggingfetch -- npx -y mcp-huggingfetch@latest
   ```

### 7. 手动测试验证 🧪
**验证包是否正常工作**:
```bash
# 手动测试包
echo '{"jsonrpc":"2.0","id":"test","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | npx -y mcp-huggingfetch@latest
```

应该看到类似的响应：
```json
{"jsonrpc":"2.0","id":"test","result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":false}},"serverInfo":{"name":"mcp-huggingfetch","version":"0.5.3"}}}
```

### 8. 调试模式 🐛
**启用详细日志**:
```bash
# 设置调试环境变量
export DEBUG=*
export LOG_LEVEL=debug

# 重新尝试连接
claude mcp list
```

## 推荐的故障排除流程

1. **立即尝试**: 重启 Claude Code 会话
2. **清除缓存**: 运行 `npm cache clean --force`
3. **手动测试**: 使用上面的手动测试命令验证包工作正常
4. **重新配置**: 完全移除并重新添加 MCP 服务器
5. **检查日志**: 在调试模式下查看详细错误信息

## 已知限制
- Claude Code 的 MCP 重连机制可能不够健壮
- 某些环境下的兼容性问题仍在解决中
- Windows 用户可能需要特殊的命令包装

如果以上方法都不能解决问题，这可能是 Claude Code 本身的已知 bug，建议向 Anthropic 团队报告。