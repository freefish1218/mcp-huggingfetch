#!/usr/bin/env node

/**
 * 测试 stdin 行为
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('测试 MCP 服务器 stdin 行为...\n');

// 启动服务器
const server = spawn('node', [path.join(__dirname, '../bin/cli.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    HUGGINGFACE_TOKEN: 'test_token',
    LOG_LEVEL: 'debug',
    MCP_LOG_FILE: '/tmp/test-stdin.log'
  }
});

let responseBuffer = '';

server.stdout.on('data', (data) => {
  console.log('收到响应:', data.toString());
  responseBuffer += data.toString();
});

server.stderr.on('data', (data) => {
  console.error('错误输出:', data.toString());
});

server.on('close', (code) => {
  console.log(`服务器退出，代码: ${code}`);
});

// 发送初始化请求
setTimeout(() => {
  const initRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  });
  
  console.log('发送初始化请求...');
  server.stdin.write(initRequest + '\n');
}, 100);

// 等待响应后发送工具列表请求
setTimeout(() => {
  const toolsRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  });
  
  console.log('发送工具列表请求...');
  server.stdin.write(toolsRequest + '\n');
}, 500);

// 保持进程运行一段时间
setTimeout(() => {
  console.log('测试完成，关闭服务器...');
  server.stdin.end();
}, 2000);