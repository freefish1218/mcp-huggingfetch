#!/usr/bin/env node

/**
 * MCP 连接诊断工具
 * 用于检查和诊断 MCP 服务器与 Claude Code 的连接问题
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 控制台颜色输出
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
};

console.log(colors.blue('==========================================='));
console.log(colors.blue('   MCP HuggingFetch 连接诊断工具'));
console.log(colors.blue('===========================================\n'));

// 步骤 1: 检查环境变量
console.log(colors.magenta('步骤 1: 检查环境变量'));
console.log('----------------------------------------');

const requiredEnvs = {
  HUGGINGFACE_TOKEN: process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN,
  DOWNLOAD_DIR: process.env.HUGGINGFETCH_DOWNLOAD_DIR || '~/Downloads/huggingface_models',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

for (const [key, value] of Object.entries(requiredEnvs)) {
  if (key === 'HUGGINGFACE_TOKEN') {
    if (value) {
      console.log(`✅ ${key}: ${colors.green('[已设置]')} (${value.substring(0, 10)}...)`);
    } else {
      console.log(`❌ ${key}: ${colors.red('[未设置]')} - 请设置您的 HuggingFace token`);
    }
  } else {
    console.log(`ℹ️  ${key}: ${value}`);
  }
}

// 步骤 2: 检查 Node.js 版本
console.log('\n' + colors.magenta('步骤 2: 检查 Node.js 版本'));
console.log('----------------------------------------');

const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

if (majorVersion >= 18) {
  console.log(`✅ Node.js 版本: ${colors.green(nodeVersion)} (满足要求 >= 18.0.0)`);
} else {
  console.log(`❌ Node.js 版本: ${colors.red(nodeVersion)} (需要 >= 18.0.0)`);
}

// 步骤 3: 检查 MCP 服务器文件
console.log('\n' + colors.magenta('步骤 3: 检查 MCP 服务器文件'));
console.log('----------------------------------------');

const serverFiles = [
  'bin/cli.js',
  'src/index.js',
  'src/mcp/server.js',
  'package.json'
];

let allFilesExist = true;
for (const file of serverFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}: ${colors.green('[存在]')}`);
  } else {
    console.log(`❌ ${file}: ${colors.red('[缺失]')}`);
    allFilesExist = false;
  }
}

// 步骤 4: 测试基本 MCP 通信
console.log('\n' + colors.magenta('步骤 4: 测试 MCP 服务器启动'));
console.log('----------------------------------------');

// 创建临时日志文件
const logFile = path.join(os.tmpdir(), `mcp-diagnose-${Date.now()}.log`);
console.log(`📝 日志文件: ${logFile}`);

// 设置测试环境
const testEnv = {
  ...process.env,
  HUGGINGFACE_TOKEN: process.env.HUGGINGFACE_TOKEN || 'test_token',
  MCP_MODE: 'true',
  LOG_LEVEL: 'debug',
  MCP_LOG_FILE: logFile
};

// 启动 MCP 服务器
const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');
console.log(`\n启动 MCP 服务器: ${cliPath}`);

const mcpProcess = spawn('node', [cliPath], {
  env: testEnv,
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverStarted = false;
let responseReceived = false;
let errorOutput = '';

// 监听 stderr
mcpProcess.stderr.on('data', (data) => {
  errorOutput += data.toString();
  console.log(colors.red(`服务器错误: ${data.toString()}`));
});

// 发送初始化请求
console.log('\n发送初始化请求...');
const initRequest = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '1.0.0',
    capabilities: {},
    clientInfo: {
      name: 'mcp-diagnose',
      version: '1.0.0'
    }
  }
});

mcpProcess.stdin.write(initRequest + '\n');

// 监听响应
mcpProcess.stdout.on('data', (data) => {
  const response = data.toString();
  console.log(colors.green('\n收到响应:'));
  
  try {
    const json = JSON.parse(response);
    console.log(JSON.stringify(json, null, 2));
    
    if (json.result) {
      responseReceived = true;
      console.log(colors.green('\n✅ MCP 服务器响应成功！'));
      
      // 发送工具列表请求
      console.log('\n发送工具列表请求...');
      const toolsRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      });
      
      // 首先发送 initialized 通知
      const initializedNotification = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialized',
        params: {}
      });
      
      mcpProcess.stdin.write(initializedNotification + '\n');
      mcpProcess.stdin.write(toolsRequest + '\n');
    }
  } catch (e) {
    console.log(colors.yellow(`原始响应: ${response}`));
  }
});

// 超时检查
setTimeout(() => {
  if (!responseReceived) {
    console.log(colors.red('\n❌ 超时：5秒内未收到服务器响应'));
    console.log(colors.yellow('\n可能的原因：'));
    console.log('1. 服务器启动失败');
    console.log('2. JSON-RPC 通信错误');
    console.log('3. 依赖包未正确安装');
    
    if (errorOutput) {
      console.log(colors.red('\n错误输出：'));
      console.log(errorOutput);
    }
  }
  
  // 查看日志文件
  if (fs.existsSync(logFile)) {
    console.log(colors.blue('\n📋 服务器日志：'));
    console.log('----------------------------------------');
    const logs = fs.readFileSync(logFile, 'utf8');
    console.log(logs);
  }
  
  // 清理
  mcpProcess.kill();
  
  // 步骤 5: 检查 Claude Code 配置
  console.log('\n' + colors.magenta('步骤 5: Claude Code 配置建议'));
  console.log('----------------------------------------');
  
  const configPath = path.join(process.cwd(), '.claude', 'claude_config.json');
  console.log(`\n建议的配置文件位置: ${colors.blue(configPath)}`);
  
  const suggestedConfig = {
    mcpServers: {
      huggingfetch: {
        command: 'node',
        args: [path.join(process.cwd(), 'bin', 'cli.js')],
        env: {
          HUGGINGFACE_TOKEN: 'your_token_here',
          HUGGINGFETCH_DOWNLOAD_DIR: './models',
          LOG_LEVEL: 'debug',
          MCP_LOG_FILE: path.join(os.tmpdir(), 'mcp-huggingfetch.log')
        }
      }
    }
  };
  
  console.log('\n建议的配置内容：');
  console.log(colors.yellow(JSON.stringify(suggestedConfig, null, 2)));
  
  console.log('\n' + colors.blue('==========================================='));
  console.log(colors.blue('   诊断完成'));
  console.log(colors.blue('==========================================='));
  
  if (responseReceived) {
    console.log(colors.green('\n✅ MCP 服务器工作正常！'));
    console.log('\n请确保：');
    console.log('1. 将上述配置添加到 Claude Code 配置文件中');
    console.log('2. 替换 "your_token_here" 为您的实际 HuggingFace token');
    console.log('3. 重启 Claude Code 以应用新配置');
  } else {
    console.log(colors.red('\n❌ MCP 服务器存在问题'));
    console.log('\n建议步骤：');
    console.log('1. 运行 npm install 确保所有依赖已安装');
    console.log('2. 检查日志文件获取更多错误信息');
    console.log('3. 确保 Node.js 版本 >= 18.0.0');
    console.log('4. 在 GitHub Issues 报告问题：https://github.com/freefish1218/mcp-huggingfetch/issues');
  }
  
  process.exit(responseReceived ? 0 : 1);
}, 5000);