#!/usr/bin/env node

/**
 * 测试增强版 Claude Code 兼容启动脚本
 */

const { spawn } = require('child_process');

console.log('🧪 测试 Claude Code 兼容启动脚本');

// 完全清洁的环境
const cleanEnv = {
  PATH: process.env.PATH,
  NODE_ENV: 'production'
  // 没有任何 HuggingFace 相关的环境变量
};

console.log('启动增强版 MCP 服务器...');

const server = spawn('node', ['./bin/claude-compatible.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: cleanEnv,
  cwd: __dirname
});

let hasJsonOutput = false;

// 监听 stdout
server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('📥 stdout:', output);
  
  // 检查是否是有效的 JSON-RPC
  const lines = output.trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const json = JSON.parse(line);
        console.log('✅ 有效 JSON-RPC:', json);
        hasJsonOutput = true;
      } catch (e) {
        console.log('⚠️  非 JSON 输出:', line);
      }
    }
  });
});

// 监听 stderr（应该很少或没有）
server.stderr.on('data', (data) => {
  const error = data.toString();
  console.log('🔴 stderr:', error);
});

// 监听进程关闭
server.on('close', (code) => {
  console.log(`🔚 进程结束: code=${code}`);
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
    id: 'test-init',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'claude-code-test',
        version: '1.0.0'
      }
    }
  };
  
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // 发送 initialized 通知
  setTimeout(() => {
    const initNotification = {
      jsonrpc: '2.0',
      method: 'initialized'
    };
    server.stdin.write(JSON.stringify(initNotification) + '\n');
    
    // 请求工具列表
    setTimeout(() => {
      const toolsRequest = {
        jsonrpc: '2.0',
        id: 'test-tools',
        method: 'tools/list'
      };
      server.stdin.write(JSON.stringify(toolsRequest) + '\n');
    }, 500);
  }, 500);
  
}, 1000);

// 5秒后检查结果并关闭
setTimeout(() => {
  if (hasJsonOutput) {
    console.log('🎉 测试成功：服务器正确响应了 JSON-RPC 请求');
  } else {
    console.log('❌ 测试失败：没有收到有效的 JSON-RPC 响应');
  }
  
  server.kill('SIGTERM');
}, 5000);