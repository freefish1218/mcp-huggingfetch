#!/usr/bin/env node

/**
 * 测试远程 npm 包是否能正常启动
 */

const { spawn } = require('child_process');

console.log('🧪 测试远程 mcp-huggingfetch@latest 包');

// 模拟 Claude Code 环境
const env = {
  PATH: process.env.PATH,
  NODE_ENV: 'production'
};

console.log('启动远程包测试...');

const server = spawn('npx', ['-y', 'mcp-huggingfetch@latest'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: env,
  timeout: 15000 // 15秒超时
});

let hasStdout = false;
let hasStderr = false;
let stderrContent = '';

server.stdout.on('data', (data) => {
  hasStdout = true;
  console.log('📥 stdout:', data.toString());
});

server.stderr.on('data', (data) => {
  hasStderr = true;
  stderrContent += data.toString();
  console.log('🔴 stderr:', data.toString());
});

server.on('close', (code, signal) => {
  console.log(`🔚 进程结束: code=${code}, signal=${signal}`);
  
  if (signal === 'SIGTERM') {
    console.log('✅ 服务器正常响应 SIGTERM');
  }
  
  console.log('\n📊 测试结果:');
  console.log(`- 有 stdout 输出: ${hasStdout ? '✅' : '❌'}`);
  console.log(`- 有 stderr 输出: ${hasStderr ? '⚠️' : '✅'}`);
  console.log(`- stderr 内容长度: ${stderrContent.length} 字符`);
  
  if (stderrContent.length > 0) {
    console.log('\n🔍 stderr 详情:');
    console.log(stderrContent);
  }
});

server.on('error', (error) => {
  console.error('❌ 启动错误:', error.message);
});

// 等待启动，然后发送初始化请求
setTimeout(() => {
  console.log('📤 发送初始化请求...');
  
  const initRequest = {
    jsonrpc: '2.0',
    id: 'test',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'claude-code',
        version: '1.0.0'
      }
    }
  };
  
  server.stdin.write(JSON.stringify(initRequest) + '\n');
}, 2000);

// 5秒后结束测试
setTimeout(() => {
  console.log('\n⏰ 测试结束');
  server.kill('SIGTERM');
}, 5000);