#!/usr/bin/env node

/**
 * MCP 协议测试脚本
 * 测试 MCP 服务器的基本功能
 */

const { spawn } = require('child_process');
const path = require('path');

const testMessages = [
  // 初始化请求
  {
    jsonrpc: '2.0',
    id: 'init',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  },
  // 初始化通知
  {
    jsonrpc: '2.0',
    method: 'initialized'
  },
  // 获取工具列表
  {
    jsonrpc: '2.0',
    id: 'tools',
    method: 'tools/list'
  }
];

console.log('🧪 启动 MCP 协议测试');

async function testMcpServer() {
  const serverPath = path.join(__dirname, '..', 'src', 'index.js');
  
  console.log('启动 MCP 服务器...');
  
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responseCount = 0;

  server.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    
    lines.forEach(line => {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          responseCount++;
          console.log(`📥 响应 ${responseCount}:`, JSON.stringify(response, null, 2));
          
          // 检查响应格式
          if (response.jsonrpc === '2.0') {
            console.log('✅ JSON-RPC 格式正确');
          } else {
            console.log('❌ JSON-RPC 格式错误');
          }
          
        } catch (error) {
          console.log('📝 服务器输出:', line);
        }
      }
    });
  });

  server.stderr.on('data', (data) => {
    console.log('⚠️  服务器错误输出:', data.toString());
  });

  server.on('close', (code) => {
    console.log(`🔚 服务器进程结束，退出码: ${code}`);
  });

  server.on('error', (error) => {
    console.error('❌ 启动服务器失败:', error);
  });

  // 等待服务器启动
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 发送测试消息
  console.log('\n📤 发送测试消息...\n');
  
  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    console.log(`📤 发送消息 ${i + 1}:`, JSON.stringify(message, null, 2));
    
    server.stdin.write(JSON.stringify(message) + '\n');
    
    // 在消息之间等待
    if (i < testMessages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // 等待响应
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 关闭服务器
  console.log('\n🔚 关闭服务器...');
  server.kill('SIGTERM');
  
  // 等待服务器关闭
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('🏁 测试完成');
}

// 设置测试环境
process.env.LOG_LEVEL = 'info';
process.env.HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || 'test_token';

testMcpServer().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});