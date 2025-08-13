#!/usr/bin/env node

/**
 * 调试 Claude Code MCP 连接问题
 */

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 Claude Code MCP 连接调试工具');
console.log('═'.repeat(50));

// 测试配置
const testConfigs = [
  {
    name: '标准配置',
    cmd: 'npx',
    args: ['-y', 'mcp-huggingfetch@latest']
  },
  {
    name: '明确版本',
    cmd: 'npx',
    args: ['-y', 'mcp-huggingfetch@0.5.3']
  },
  {
    name: 'Windows兼容',
    cmd: process.platform === 'win32' ? 'cmd' : 'sh',
    args: process.platform === 'win32' 
      ? ['/c', 'npx', '-y', 'mcp-huggingfetch@latest']
      : ['-c', 'npx -y mcp-huggingfetch@latest']
  }
];

async function testConnection(config) {
  return new Promise((resolve) => {
    console.log(`\n🧪 测试配置: ${config.name}`);
    console.log(`命令: ${config.cmd} ${config.args.join(' ')}`);
    
    const server = spawn(config.cmd, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production' // 模拟 Claude Code 环境
      }
    });
    
    let stdout = '';
    let stderr = '';
    let responseReceived = false;
    
    const timeout = setTimeout(() => {
      console.log('⏰ 连接超时');
      server.kill('SIGTERM');
    }, 10000);
    
    server.stdout.on('data', (data) => {
      stdout += data.toString();
      
      // 检查是否收到有效响应
      const lines = data.toString().trim().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          try {
            const json = JSON.parse(line);
            if (json.jsonrpc === '2.0' && json.result) {
              responseReceived = true;
              console.log('✅ 收到有效 JSON-RPC 响应');
              console.log(`   服务器: ${json.result.serverInfo?.name} v${json.result.serverInfo?.version}`);
            }
          } catch (e) {
            // 非 JSON 输出，忽略
          }
        }
      });
    });
    
    server.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    server.on('close', (code, signal) => {
      clearTimeout(timeout);
      
      const result = {
        config: config.name,
        success: responseReceived,
        exitCode: code,
        signal: signal,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        stderr: stderr.trim()
      };
      
      console.log(`📊 结果: ${result.success ? '✅ 成功' : '❌ 失败'}`);
      console.log(`   退出码: ${code}, 信号: ${signal}`);
      console.log(`   stdout: ${stdout.length} 字符, stderr: ${stderr.length} 字符`);
      
      if (stderr.length > 0 && process.env.DEBUG) {
        console.log(`   stderr 详情: ${stderr.trim()}`);
      }
      
      resolve(result);
    });
    
    server.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`❌ 启动失败: ${error.message}`);
      resolve({
        config: config.name,
        success: false,
        error: error.message
      });
    });
    
    // 等待启动后发送初始化请求
    setTimeout(() => {
      const initRequest = {
        jsonrpc: '2.0',
        id: 'debug-test',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'claude-code-debug',
            version: '1.0.0'
          }
        }
      };
      
      server.stdin.write(JSON.stringify(initRequest) + '\n');
    }, 1000);
  });
}

async function runDiagnostics() {
  console.log('🔧 运行诊断测试...');
  
  const results = [];
  
  for (const config of testConfigs) {
    const result = await testConnection(config);
    results.push(result);
  }
  
  console.log('\n📋 诊断报告');
  console.log('═'.repeat(50));
  
  const successCount = results.filter(r => r.success).length;
  
  console.log(`总测试: ${results.length}, 成功: ${successCount}, 失败: ${results.length - successCount}`);
  
  if (successCount === 0) {
    console.log('\n❌ 所有配置都失败了！');
    console.log('可能的问题:');
    console.log('- 网络连接问题');
    console.log('- npm/npx 配置问题');
    console.log('- 环境变量问题');
    console.log('- Claude Code 特定的兼容性问题');
  } else if (successCount < results.length) {
    console.log('\n⚠️ 部分配置失败');
    console.log('建议使用成功的配置更新 MCP 设置');
  } else {
    console.log('\n✅ 所有配置都成功！');
    console.log('如果 Claude Code 仍然无法连接，可能是客户端缓存或配置问题');
  }
  
  // 保存详细结果
  const reportFile = 'mcp-connection-report.json';
  fs.writeFileSync(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    results: results,
    environment: {
      platform: process.platform,
      nodeVersion: process.version,
      npmVersion: process.env.npm_version || 'unknown'
    }
  }, null, 2));
  
  console.log(`\n📄 详细报告已保存到: ${reportFile}`);
}

// 检查环境变量
if (process.env.DEBUG) {
  console.log('🐛 调试模式已启用');
}

runDiagnostics().catch(error => {
  console.error('❌ 诊断过程出错:', error);
  process.exit(1);
});