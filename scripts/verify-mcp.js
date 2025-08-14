#!/usr/bin/env node

/**
 * MCP 连接验证脚本
 * 快速验证 MCP 服务器是否能正常工作
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 验证 MCP 服务器连接...\n');

const server = spawn('node', [path.join(__dirname, '..', 'bin', 'cli.js')], {
  env: {
    ...process.env,
    MCP_MODE: 'true',
    NODE_ENV: 'production',
    HUGGINGFACE_TOKEN: process.env.HUGGINGFACE_TOKEN || 'test_token'
  }
});

let success = false;

server.stdout.once('data', (data) => {
  try {
    const line = data.toString().split('\n')[0];
    if (line && JSON.parse(line)) {
      success = true;
      console.log('✅ MCP 服务器响应正常');
    }
  } catch (e) {
    console.error('❌ 服务器响应格式错误');
  }
});

server.stderr.once('data', (data) => {
  if (data.toString().includes('Fatal error')) {
    console.error('❌ 服务器启动失败:', data.toString());
  }
});

// 发送初始化请求
setTimeout(() => {
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '0.1.0', capabilities: {} }
  }) + '\n');
}, 100);

// 检查结果
setTimeout(() => {
  if (success) {
    console.log('\n✅ MCP 服务器工作正常！');
    console.log('📋 你可以在 Claude Code 中配置此服务器');
  } else {
    console.log('\n❌ MCP 服务器未响应');
    console.log('请检查 /tmp/mcp-huggingfetch.log 获取详细信息');
  }
  server.kill();
  process.exit(success ? 0 : 1);
}, 1000);