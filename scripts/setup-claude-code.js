#!/usr/bin/env node

/**
 * Claude Code MCP 配置助手
 * 帮助用户正确配置 Claude Code 的 MCP 连接
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 控制台颜色
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
};

console.log(colors.cyan('==========================================='));
console.log(colors.cyan('   Claude Code MCP 配置助手'));
console.log(colors.cyan('===========================================\n'));

// 检查 HuggingFace Token
const token = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;
if (!token) {
  console.log(colors.red('⚠️  警告: 未检测到 HUGGINGFACE_TOKEN'));
  console.log(colors.yellow('请先设置环境变量或在配置中提供 token\n'));
}

// 确定配置文件路径
const projectRoot = process.cwd();
const claudeConfigDir = path.join(projectRoot, '.claude');
const claudeConfigPath = path.join(claudeConfigDir, 'claude_config.json');

console.log(colors.blue('📁 项目路径:'), projectRoot);
console.log(colors.blue('📄 配置文件:'), claudeConfigPath);

// 创建配置
const config = {
  mcpServers: {
    huggingfetch: {
      command: 'npx',
      args: ['-y', 'mcp-huggingfetch@latest'],
      env: {
        HUGGINGFACE_TOKEN: token || 'your_huggingface_token_here',
        HUGGINGFETCH_DOWNLOAD_DIR: './models',
        LOG_LEVEL: 'info'
      }
    }
  }
};

// 对于本地开发，使用本地路径
if (fs.existsSync(path.join(projectRoot, 'package.json'))) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  if (packageJson.name === 'mcp-huggingfetch') {
    console.log(colors.green('\n✅ 检测到本地开发环境'));
    config.mcpServers.huggingfetch = {
      command: 'node',
      args: [path.join(projectRoot, 'bin', 'cli.js')],
      env: {
        HUGGINGFACE_TOKEN: token || 'your_huggingface_token_here',
        HUGGINGFETCH_DOWNLOAD_DIR: './models',
        LOG_LEVEL: 'debug',
        MCP_LOG_FILE: path.join(os.tmpdir(), 'mcp-huggingfetch.log')
      }
    };
  }
}

// 创建 .claude 目录
if (!fs.existsSync(claudeConfigDir)) {
  console.log(colors.yellow('\n创建 .claude 目录...'));
  fs.mkdirSync(claudeConfigDir, { recursive: true });
  console.log(colors.green('✅ 目录创建成功'));
}

// 检查现有配置
let existingConfig = {};
if (fs.existsSync(claudeConfigPath)) {
  console.log(colors.yellow('\n发现现有配置文件'));
  try {
    existingConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
    console.log('现有配置:', JSON.stringify(existingConfig, null, 2));
  } catch (error) {
    console.log(colors.red('读取现有配置失败:', error.message));
  }
}

// 合并配置
const finalConfig = {
  ...existingConfig,
  mcpServers: {
    ...existingConfig.mcpServers,
    ...config.mcpServers
  }
};

// 写入配置文件
console.log(colors.yellow('\n写入配置文件...'));
fs.writeFileSync(claudeConfigPath, JSON.stringify(finalConfig, null, 2));
console.log(colors.green('✅ 配置文件写入成功'));

// 显示配置内容
console.log(colors.cyan('\n=== 配置内容 ==='));
console.log(JSON.stringify(finalConfig, null, 2));

// 提供后续步骤
console.log(colors.cyan('\n=== 后续步骤 ==='));
console.log('1. ' + (token ? colors.green('✅') : colors.red('❌')) + ' 设置 HuggingFace Token');
if (!token) {
  console.log('   请编辑配置文件，将 "your_huggingface_token_here" 替换为您的实际 token');
  console.log('   获取 token: https://huggingface.co/settings/tokens');
}

console.log('\n2. 重启 Claude Code');
console.log('   ' + colors.yellow('关闭并重新打开 Claude Code 以加载新配置'));

console.log('\n3. 验证连接');
console.log('   在 Claude Code 中输入:');
console.log('   ' + colors.blue('/mcp'));
console.log('   查看是否显示 "huggingfetch" 服务器');

console.log('\n4. 测试功能');
console.log('   尝试下载一个小模型:');
console.log('   ' + colors.blue('"请帮我下载 bert-base-uncased 的配置文件"'));

// 故障排查
console.log(colors.cyan('\n=== 故障排查 ==='));
console.log('如果仍然无法连接，请运行诊断工具:');
console.log(colors.yellow('npm run test:diagnose'));
console.log('\n或查看 MCP 日志:');
console.log(colors.yellow(`cat ${path.join(os.tmpdir(), 'mcp-huggingfetch.log')}`));

console.log(colors.cyan('\n==========================================='));
console.log(colors.green('配置完成！'));
console.log(colors.cyan('==========================================='));