#!/usr/bin/env node

/**
 * 测试修复后的版本是否解决了 Claude Code 兼容性问题
 */

const { spawn } = require('child_process');

console.log('🧪 测试修复后的版本');

// 模拟 Claude Code 的生产环境
const productionEnv = {
  PATH: process.env.PATH,
  NODE_ENV: 'production'
  // 没有 HUGGINGFACE_TOKEN
};

console.log('启动修复后的 MCP 服务器（模拟生产环境）...');

const server = spawn('node', ['./bin/cli.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: productionEnv,
  cwd: __dirname
});

let hasResponse = false;
let stderrOutput = '';

// 监听 stdout
server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('📥 stdout:', output);
  
  // 检查 JSON-RPC 响应
  const lines = output.trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      try {
        JSON.parse(line);
        hasResponse = true;
        console.log('✅ 收到有效的 JSON-RPC 响应');
      } catch (e) {
        console.log('⚠️  非 JSON 输出:', line);
      }
    }
  });
});

// 监听 stderr（应该显著减少）
server.stderr.on('data', (data) => {
  const error = data.toString();
  stderrOutput += error;
  console.log('🔴 stderr:', error);
});

// 监听进程关闭
server.on('close', (code) => {
  console.log(`🔚 进程结束: code=${code}`);
  
  console.log('\n📊 测试结果:');
  console.log(`- 有 JSON-RPC 响应: ${hasResponse ? '✅' : '❌'}`);
  console.log(`- stderr 输出字符数: ${stderrOutput.length}`);
  
  if (stderrOutput.length < 50) {
    console.log('✅ stderr 输出已显著减少，有助于 Claude Code 兼容性');
  } else {
    console.log('⚠️  stderr 输出仍然较多，可能影响兼容性');
  }
});

// 监听错误
server.on('error', (error) => {
  console.error('❌ 进程错误:', error);
});

// 等待服务器启动，然后发送测试请求
setTimeout(() => {
  console.log('📤 发送初始化请求...');
  
  const initRequest = {
    jsonrpc: '2.0',
    id: 'claude-test',
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
}, 1000);

// 3秒后关闭测试
setTimeout(() => {
  console.log('\n⏰ 测试时间结束，关闭服务器');
  server.kill('SIGTERM');
}, 3000);