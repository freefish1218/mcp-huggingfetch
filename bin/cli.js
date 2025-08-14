#!/usr/bin/env node

/**
 * MCP HuggingFetch CLI 入口点
 * 启动 MCP 服务器，通过 stdin/stdout 与客户端通信
 */

const { McpServer } = require('../src/mcp/server');
const { createLogger } = require('../src/utils/logger');

// 设置 MCP 模式标志
process.env.MCP_MODE = 'true';

// 为 Claude Code 兼容性设置默认环境变量
if (!process.env.HUGGINGFACE_TOKEN && !process.env.HF_TOKEN) {
  process.env.HUGGINGFACE_TOKEN = 'default_token_placeholder';
}

// MCP 模式下设置日志级别和文件
if (!process.env.LOG_LEVEL) {
  process.env.LOG_LEVEL = process.env.DEBUG ? 'debug' : 'error';
}

// 设置日志文件路径
if (!process.env.MCP_LOG_FILE) {
  const os = require('os');
  const path = require('path');
  process.env.MCP_LOG_FILE = path.join(os.tmpdir(), 'mcp-huggingfetch.log');
}

// 初始化日志系统
const logger = createLogger();

async function main() {
  try {
    // 在 MCP 模式下不输出任何启动信息到控制台
    logger.info(`启动 MCP HuggingFetch 服务器 v${require('../package.json').version}`);

    // 创建并运行 MCP 服务器
    const server = new McpServer();
    await server.run();
  } catch (error) {
    // 在 MCP 模式下，只在出错时输出到 stderr
    if (process.env.MCP_MODE === 'true') {
      process.stderr.write(`Server startup failed: ${error.message}\n`);
    }
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  // 在 MCP 模式下，输出错误到 stderr 并退出
  if (process.env.MCP_MODE === 'true') {
    process.stderr.write(`Fatal error: ${error.message}\n`);
  }
  logger.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // 在 MCP 模式下，输出错误到 stderr 并退出
  if (process.env.MCP_MODE === 'true') {
    process.stderr.write(`Fatal error: ${reason}\n`);
  }
  logger.error('未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', () => {
  logger.info('收到 SIGINT，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM，正在关闭服务器...');
  process.exit(0);
});

main().catch(error => {
  logger.error('主程序执行失败:', error);
  process.exit(1);
});
