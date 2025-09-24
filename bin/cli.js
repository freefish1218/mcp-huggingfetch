#!/usr/bin/env node

/**
 * MCP HuggingFetch CLI 入口点
 * 启动 MCP 服务器，通过 stdin/stdout 与客户端通信
 */

const { McpServer } = require('../src/mcp/server');
const { createLogger } = require('../src/utils/logger');

// 设置 MCP 模式标志
process.env.MCP_MODE = 'true';

// Token 验证由各模块内部处理，不设置占位符
// 让验证逻辑明确提示用户配置 HUGGINGFACE_TOKEN 或 HF_TOKEN

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

// 保存服务器实例，用于优雅关闭
let serverInstance = null;
let isShuttingDown = false;

// 优雅关闭函数
async function gracefulShutdown(exitCode = 0) {
  if (isShuttingDown) {
    return; // 防止重复关闭
  }

  isShuttingDown = true;
  logger.info('开始优雅关闭...');

  try {
    // 给正在进行的操作一些时间来完成
    if (serverInstance) {
      // 设置最长等待时间为10秒
      const shutdownTimeout = setTimeout(() => {
        logger.warn('优雅关闭超时，强制退出');
        process.exit(exitCode);
      }, 10000);

      // 尝试关闭服务器
      if (serverInstance.shutdown) {
        await serverInstance.shutdown();
      }

      clearTimeout(shutdownTimeout);
    }
  } catch (error) {
    logger.error('优雅关闭时出错:', error);
  }

  logger.info('优雅关闭完成');
  process.exit(exitCode);
}

async function main() {
  try {
    // 在 MCP 模式下不输出任何启动信息到控制台
    logger.info(`启动 MCP HuggingFetch 服务器 v${require('../package.json').version}`);

    // 创建并运行 MCP 服务器
    serverInstance = new McpServer();
    await serverInstance.run();
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
  // 在 MCP 模式下，输出错误到 stderr
  if (process.env.MCP_MODE === 'true') {
    process.stderr.write(`Fatal error: ${error.message}\n`);
  }
  logger.error('未捕获的异常:', error);

  // 优雅关闭
  gracefulShutdown(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // 在 MCP 模式下，输出错误到 stderr
  if (process.env.MCP_MODE === 'true') {
    process.stderr.write(`Fatal error: ${reason}\n`);
  }
  logger.error('未处理的 Promise 拒绝:', reason);

  // 优雅关闭
  gracefulShutdown(1);
});

// 优雅关闭
process.on('SIGINT', () => {
  logger.info('收到 SIGINT，正在关闭服务器...');
  gracefulShutdown(0);
});

process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM，正在关闭服务器...');
  gracefulShutdown(0);
});

main().catch(error => {
  logger.error('主程序执行失败:', error);
  process.exit(1);
});
