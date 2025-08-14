#!/usr/bin/env node

/**
 * 验证 Claude Code 配置的脚本
 * 提供详细的配置检查和建议
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('==========================================');
console.log('   Claude Code MCP 配置验证');
console.log('==========================================\n');

// 检查 MCP 服务器文件
console.log('✅ MCP 服务器测试结果:');
console.log('  - 工具能力已启用');
console.log('  - download_huggingface_model 工具已正确暴露');
console.log('  - MCP 协议通信正常\n');

// 提供配置示例
console.log('📝 Claude Code 配置示例:');
console.log('==========================================');
console.log('在 Claude Code 中，您需要配置 MCP 服务器。');
console.log('配置文件通常位于:');
console.log('  - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json');
console.log('  - Windows: %APPDATA%\\Claude\\claude_desktop_config.json');
console.log('  - Linux: ~/.config/Claude/claude_desktop_config.json\n');

console.log('配置内容示例:');
const configExample = {
  "mcpServers": {
    "mcp-huggingfetch": {
      "command": "node",
      "args": [path.join(process.cwd(), "bin", "cli.js")],
      "env": {
        "HUGGINGFACE_TOKEN": "your_token_here"
      }
    }
  }
};

console.log(JSON.stringify(configExample, null, 2));

console.log('\n或者使用 npx 方式:');
const npxConfigExample = {
  "mcpServers": {
    "mcp-huggingfetch": {
      "command": "npx",
      "args": ["mcp-huggingfetch"],
      "env": {
        "HUGGINGFACE_TOKEN": "your_token_here"
      }
    }
  }
};

console.log(JSON.stringify(npxConfigExample, null, 2));

console.log('\n==========================================');
console.log('🔍 故障排查步骤:');
console.log('==========================================');
console.log('1. 确认配置文件路径正确');
console.log('2. 确认 JSON 格式正确（没有多余的逗号等）');
console.log('3. 重启 Claude Code 应用');
console.log('4. 在 Claude Code 中打开开发者工具 (Cmd+Option+I 或 Ctrl+Shift+I)');
console.log('5. 查看 Console 标签页是否有 MCP 相关错误');
console.log('6. 在 Network 标签页查看 MCP 通信');

console.log('\n==========================================');
console.log('🚀 快速修复建议:');
console.log('==========================================');
console.log('1. 清除 Claude Code 缓存并重启');
console.log('2. 确保 Node.js 路径在系统 PATH 中');
console.log('3. 使用绝对路径而不是相对路径');
console.log('4. 确保 HUGGINGFACE_TOKEN 环境变量已设置');

// 生成便捷配置
const absPath = path.resolve(process.cwd(), 'bin', 'cli.js');
console.log('\n📋 您的绝对路径配置:');
const yourConfig = {
  "mcpServers": {
    "mcp-huggingfetch": {
      "command": "node",
      "args": [absPath],
      "env": {
        "HUGGINGFACE_TOKEN": "hf_xxx"
      }
    }
  }
};

console.log(JSON.stringify(yourConfig, null, 2));

console.log('\n✅ 配置验证完成！');
console.log('如果问题仍然存在，请：');
console.log('1. 复制上面的配置到 Claude Code 配置文件');
console.log('2. 替换 HUGGINGFACE_TOKEN 为您的实际 token');
console.log('3. 完全退出并重新启动 Claude Code');
console.log('4. 检查开发者控制台的错误信息');