#!/usr/bin/env node

// 基本功能测试
try {
  // 测试导入
  const { getConfig } = require('../src/core/config');
  const { createLogger } = require('../src/utils/logger');
  const { McpServer } = require('../src/mcp/server');
  
  console.log('✅ 模块导入成功');
  
  // 测试配置
  const config = getConfig();
  console.log('✅ 配置系统正常');
  console.log('配置信息:', config.getSummary());
  
  // 测试日志
  const logger = createLogger();
  logger.info('✅ 日志系统正常');
  
  // 测试 MCP 服务器创建
  const server = new McpServer();
  console.log('✅ MCP 服务器创建成功');
  console.log('服务器状态:', server.getStatus());
  
  console.log('\n🎉 所有基础功能测试通过！');
  
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  process.exit(1);
}