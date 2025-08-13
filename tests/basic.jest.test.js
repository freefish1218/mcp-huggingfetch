// Jest 测试文件
describe('MCP HuggingFetch 基础测试', () => {
  test('模块导入测试', () => {
    const { getConfig } = require('../src/core/config');
    const { createLogger } = require('../src/utils/logger');
    const { McpServer } = require('../src/mcp/server');
    
    expect(getConfig).toBeDefined();
    expect(createLogger).toBeDefined();
    expect(McpServer).toBeDefined();
  });
  
  test('配置系统测试', () => {
    const { getConfig } = require('../src/core/config');
    const config = getConfig();
    
    expect(config).toBeDefined();
    expect(config.getSummary).toBeDefined();
    
    const summary = config.getSummary();
    expect(summary).toHaveProperty('download_dir');
    expect(summary).toHaveProperty('hf_home');
  });
  
  test('MCP 服务器创建测试', () => {
    const { McpServer } = require('../src/mcp/server');
    const server = new McpServer();
    
    expect(server).toBeDefined();
    expect(server.getStatus).toBeDefined();
    
    const status = server.getStatus();
    expect(status).toHaveProperty('initialized');
    expect(status).toHaveProperty('version');
  });
});