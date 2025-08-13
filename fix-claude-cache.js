#!/usr/bin/env node

/**
 * 清除 Claude Code MCP 缓存问题的修复脚本
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔧 Claude Code MCP 缓存修复工具');
console.log('═'.repeat(50));

function runCommand(cmd, description) {
  console.log(`\n📋 ${description}`);
  console.log(`💻 执行: ${cmd}`);
  
  try {
    const output = execSync(cmd, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log('✅ 成功');
    if (output.trim()) {
      console.log(`📤 输出: ${output.trim()}`);
    }
    return true;
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
    return false;
  }
}

async function testPackageVersion() {
  return new Promise((resolve) => {
    console.log('\n🧪 测试当前包版本...');
    
    const server = spawn('npx', ['-y', 'mcp-huggingfetch@latest'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    let version = null;
    let hasStderr = false;
    
    server.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          try {
            const json = JSON.parse(line);
            if (json.result && json.result.serverInfo) {
              version = json.result.serverInfo.version;
            }
          } catch (e) {
            // 忽略非 JSON 输出
          }
        }
      });
    });
    
    server.stderr.on('data', (data) => {
      hasStderr = true;
    });
    
    server.on('close', () => {
      resolve({ version, hasStderr });
    });
    
    // 发送初始化请求
    setTimeout(() => {
      server.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 'test',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      }) + '\n');
      
      setTimeout(() => server.kill('SIGTERM'), 2000);
    }, 1000);
  });
}

async function main() {
  console.log('\n🔍 步骤 1: 检查当前状态');
  
  let testResult = await testPackageVersion();
  console.log(`📊 当前版本: ${testResult.version || '未知'}`);
  console.log(`📊 有 stderr 输出: ${testResult.hasStderr ? '是' : '否'}`);
  
  if (testResult.version === '0.5.3' && !testResult.hasStderr) {
    console.log('\n✅ 当前版本已经是最新且工作正常！');
    console.log('如果 Claude Code 仍然无法连接，问题可能在客户端配置。');
    return;
  }
  
  console.log('\n🧹 步骤 2: 清除缓存');
  
  // 清除 npm 缓存
  runCommand('npm cache clean --force', '清除 npm 缓存');
  
  // 清除可能的 npx 缓存位置
  const npxCacheDir = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npxCacheDir)) {
    try {
      fs.rmSync(npxCacheDir, { recursive: true, force: true });
      console.log('✅ 清除 npx 缓存目录');
    } catch (error) {
      console.log(`⚠️ 无法清除 npx 缓存: ${error.message}`);
    }
  }
  
  // 对于 pnpm 用户
  runCommand('pnpm store prune 2>/dev/null || true', '清除 pnpm 存储（如果存在）');
  
  console.log('\n🔄 步骤 3: 强制重新下载');
  
  // 强制重新下载最新版本
  runCommand('npx --yes mcp-huggingfetch@0.5.3 --version 2>/dev/null || echo "命令完成"', '强制下载 0.5.3 版本');
  
  console.log('\n🧪 步骤 4: 验证修复结果');
  
  testResult = await testPackageVersion();
  console.log(`📊 新版本: ${testResult.version || '未知'}`);
  console.log(`📊 有 stderr 输出: ${testResult.hasStderr ? '是' : '否'}`);
  
  if (testResult.version === '0.5.3' && !testResult.hasStderr) {
    console.log('\n🎉 修复成功！');
    console.log('现在 Claude Code 应该能够正常连接了。');
    
    console.log('\n📋 下一步操作:');
    console.log('1. 重启 Claude Code 会话');
    console.log('2. 运行 "claude mcp list" 检查连接状态');
    console.log('3. 如果仍然失败，尝试重新配置 MCP 服务器');
  } else {
    console.log('\n⚠️ 修复可能不完整');
    console.log('建议手动检查网络连接和权限设置。');
  }
  
  console.log('\n📄 生成修复报告...');
  const report = {
    timestamp: new Date().toISOString(),
    before: { version: testResult.version, hasStderr: testResult.hasStderr },
    after: testResult,
    success: testResult.version === '0.5.3' && !testResult.hasStderr
  };
  
  fs.writeFileSync('mcp-fix-report.json', JSON.stringify(report, null, 2));
  console.log('✅ 修复报告已保存到 mcp-fix-report.json');
}

main().catch(error => {
  console.error('❌ 修复过程出错:', error);
  process.exit(1);
});