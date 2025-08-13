#!/usr/bin/env node

/**
 * MCP HuggingFetch CLI 入口点
 * 启动 MCP 服务器，通过 stdin/stdout 与客户端通信
 */

const { McpServer } = require('../src/mcp/server');
const { createLogger } = require('../src/utils/logger');

// 为 Claude Code 兼容性设置默认环境变量
if (!process.env.HUGGINGFACE_TOKEN && !process.env.HF_TOKEN) {
  process.env.HUGGINGFACE_TOKEN = 'default_token_placeholder';
}

// 如果是生产环境（由 Claude Code 调用），降低日志级别
if (!process.env.LOG_LEVEL && process.env.NODE_ENV === 'production') {
  process.env.LOG_LEVEL = 'warn';
}

// 初始化日志系统
const logger = createLogger();

async function main() {
  try {
    // 只在非生产环境输出详细启动信息
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`启动 MCP HuggingFetch 服务器 v${require('../package.json').version}`);
    }

    // 创建并运行 MCP 服务器
    const server = new McpServer();
    await server.run();
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
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
