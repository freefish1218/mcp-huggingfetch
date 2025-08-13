#!/usr/bin/env node

/**
 * 构建脚本
 * 用于生成各平台的预编译二进制文件
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const pkg = require('../package.json');

console.log(`构建 ${pkg.name} v${pkg.version}`);

// 清理 dist 目录
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  fs.removeSync(distDir);
}
fs.ensureDirSync(distDir);

// 目标平台
const targets = [
  'node18-linux-x64',
  'node18-macos-x64',
  'node18-win-x64'
];

console.log('开始构建预编译二进制文件...');

for (const target of targets) {
  try {
    console.log(`构建 ${target}...`);
    
    const outputName = target.includes('win') ? 'mcp-huggingfetch.exe' : 'mcp-huggingfetch';
    const outputPath = path.join(distDir, `${target}-${outputName}`);
    
    execSync(`npx pkg . --target ${target} --output "${outputPath}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    console.log(`✅ ${target} 构建完成: ${outputPath}`);
  } catch (error) {
    console.error(`❌ ${target} 构建失败:`, error.message);
  }
}

console.log('构建完成！');
console.log(`输出目录: ${distDir}`);

// 显示文件大小
console.log('\n文件大小:');
const files = fs.readdirSync(distDir);
files.forEach(file => {
  const filePath = path.join(distDir, file);
  const stats = fs.statSync(filePath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`  ${file}: ${sizeMB} MB`);
});