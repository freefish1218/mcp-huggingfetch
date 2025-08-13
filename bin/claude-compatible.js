#!/usr/bin/env node

/**
 * Claude Code 兼容性增强的 MCP HuggingFetch 启动脚本
 * 确保在任何环境下都能稳定运行
 */

const { McpServer } = require('../src/mcp/server');

// 设置默认环境变量（如果没有的话）
if (!process.env.HUGGINGFACE_TOKEN && !process.env.HF_TOKEN) {
  // 设置一个虚拟 token，避免配置系统报错
  process.env.HUGGINGFACE_TOKEN = 'placeholder_token';
}

// 禁用详细日志以避免 stderr 干扰
process.env.LOG_LEVEL = 'error';

async function main() {
  try {
    // 创建并运行 MCP 服务器
    const server = new McpServer();
    
    // 不输出启动信息到 stderr，因为可能干扰 Claude Code
    // console.error('MCP HuggingFetch Server starting...');
    
    await server.run();
  } catch (error) {
    // 只在严重错误时才输出
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// 减少异常处理输出
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

main().catch(error => {
  console.error('Main error:', error.message);
  process.exit(1);
});