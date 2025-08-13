#!/usr/bin/env node

/**
 * MCP HuggingFetch CLI 入口点
 * 启动 MCP 服务器，通过 stdin/stdout 与客户端通信
 */

const { McpServer } = require('../src/mcp/server');
const { createLogger } = require('../src/utils/logger');

// 初始化日志系统
const logger = createLogger();

async function main() {
  try {
    logger.info(`启动 MCP HuggingFetch 服务器 v${require('../package.json').version}`);

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
