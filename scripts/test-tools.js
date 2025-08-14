#!/usr/bin/env node

/**
 * 测试 MCP 工具暴露的详细脚本
 * 验证 Claude Code 能否正确看到工具
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

// MCP 服务器路径
const serverPath = path.join(__dirname, '..', 'bin', 'cli.js');

console.log('==========================================');
console.log('   MCP 工具暴露测试');
console.log('==========================================\n');

// 启动 MCP 服务器
console.log(`启动 MCP 服务器: ${serverPath}`);
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'development',
    LOG_LEVEL: 'debug'
  }
});

// 创建 readline 接口来读取响应
const rl = readline.createInterface({
  input: server.stdout,
  crlfDelay: Infinity
});

// 存储接收到的响应
const responses = [];

// 监听响应
rl.on('line', (line) => {
  if (line.trim()) {
    console.log('\n收到响应:');
    try {
      const response = JSON.parse(line);
      console.log(JSON.stringify(response, null, 2));
      responses.push(response);
      
      // 分析响应
      if (response.result) {
        if (response.result.capabilities) {
          console.log('\n✅ 收到初始化响应');
          console.log('工具能力设置:', response.result.capabilities.tools);
          if (!response.result.capabilities.tools) {
            console.error('❌ 工具能力未启用！');
          }
        }
        if (response.result.tools) {
          console.log('\n✅ 收到工具列表');
          console.log('工具数量:', response.result.tools.length);
          response.result.tools.forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.description}`);
          });
          if (response.result.tools.length === 0) {
            console.error('❌ 没有找到任何工具！');
          }
        }
      }
    } catch (e) {
      console.error('解析响应失败:', e.message);
    }
  }
});

// 监听错误输出
server.stderr.on('data', (data) => {
  console.error('服务器错误:', data.toString());
});

// 发送请求的函数
function sendRequest(request) {
  const requestStr = JSON.stringify(request);
  console.log('\n发送请求:');
  console.log(JSON.stringify(request, null, 2));
  server.stdin.write(requestStr + '\n');
}

// 测试流程
async function runTests() {
  // 等待服务器启动
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n==========================================');
  console.log('步骤 1: 发送初始化请求');
  console.log('==========================================');
  
  // 1. 发送初始化请求
  sendRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: true
        }
      },
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  });

  // 等待响应
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n==========================================');
  console.log('步骤 2: 发送 initialized 通知');
  console.log('==========================================');
  
  // 2. 发送 initialized 通知（无需响应）
  sendRequest({
    jsonrpc: '2.0',
    method: 'initialized',
    params: {}
  });

  // 等待处理
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n==========================================');
  console.log('步骤 3: 请求工具列表');
  console.log('==========================================');
  
  // 3. 请求工具列表
  sendRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  });

  // 等待响应
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n==========================================');
  console.log('步骤 4: 测试工具调用（只测试参数验证）');
  console.log('==========================================');
  
  // 4. 测试工具调用
  sendRequest({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'download_huggingface_model',
      arguments: {
        repo_id: 'test/repo'
      }
    }
  });

  // 等待响应
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 分析结果
  console.log('\n==========================================');
  console.log('测试结果总结');
  console.log('==========================================');
  
  let hasInitResponse = false;
  let hasToolsEnabled = false;
  let hasToolsList = false;
  let toolsCount = 0;

  responses.forEach(resp => {
    if (resp.id === 1 && resp.result) {
      hasInitResponse = true;
      if (resp.result.capabilities && resp.result.capabilities.tools) {
        hasToolsEnabled = true;
      }
    }
    if (resp.id === 2 && resp.result && resp.result.tools) {
      hasToolsList = true;
      toolsCount = resp.result.tools.length;
    }
  });

  console.log(`✅ 初始化响应: ${hasInitResponse ? '成功' : '失败'}`);
  console.log(`✅ 工具能力启用: ${hasToolsEnabled ? '是' : '否'}`);
  console.log(`✅ 工具列表响应: ${hasToolsList ? '成功' : '失败'}`);
  console.log(`✅ 工具数量: ${toolsCount}`);

  if (!hasToolsEnabled) {
    console.error('\n❌ 问题: 工具能力未启用！');
    console.error('请检查 src/mcp/server.js 中的 setToolsCapability 设置');
  }

  if (toolsCount === 0) {
    console.error('\n❌ 问题: 没有找到任何工具！');
    console.error('请检查 src/mcp/tools.js 中的工具定义');
  }

  if (hasToolsEnabled && toolsCount > 0) {
    console.log('\n✅ 所有测试通过！MCP 服务器工具暴露正常。');
    console.log('如果 Claude Code 仍然看不到工具，请检查:');
    console.log('1. Claude Code 的 MCP 配置文件路径是否正确');
    console.log('2. Claude Code 是否已重新加载 MCP 配置');
    console.log('3. 查看 Claude Code 的开发者控制台是否有错误信息');
  }

  // 关闭服务器
  setTimeout(() => {
    server.kill();
    process.exit(0);
  }, 1000);
}

// 运行测试
runTests().catch(error => {
  console.error('测试失败:', error);
  server.kill();
  process.exit(1);
});