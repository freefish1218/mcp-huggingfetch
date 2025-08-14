#!/usr/bin/env node

/**
 * 测试目录自动创建功能
 */

const { HuggingFaceDownloader } = require('./src/core/downloader');
const { getConfig } = require('./src/core/config');
const path = require('path');
const fs = require('fs-extra');

async function testDirectoryCreation() {
  console.log('测试目录自动创建功能...\n');
  
  // 测试目录路径（多层嵌套）
  const testDir = path.join(__dirname, 'test-downloads', 'deep', 'nested', 'models');
  
  // 确保测试目录不存在
  if (await fs.pathExists(testDir)) {
    console.log(`清理已存在的测试目录: ${testDir}`);
    await fs.remove(path.join(__dirname, 'test-downloads'));
  }
  
  console.log(`测试目录: ${testDir}`);
  console.log(`目录存在: ${await fs.pathExists(testDir)}\n`);
  
  try {
    // 创建下载器实例
    const downloader = new HuggingFaceDownloader();
    const config = await getConfig();
    
    // 测试下载一个小文件
    const result = await downloader.download({
      repo_id: 'bert-base-uncased',
      download_dir: testDir,
      files: ['config.json'],  // 只下载配置文件，很小
      revision: 'main'
    }, config);
    
    console.log('\n✅ 测试成功！');
    console.log(`目录已自动创建: ${await fs.pathExists(testDir)}`);
    console.log(`下载路径: ${result.download_path}`);
    
    // 检查下载的文件
    const configFile = path.join(testDir, 'config.json');
    if (await fs.pathExists(configFile)) {
      const stats = await fs.stat(configFile);
      console.log(`下载文件大小: ${stats.size} bytes`);
    }
    
    // 清理测试目录
    console.log('\n清理测试目录...');
    await fs.remove(path.join(__dirname, 'test-downloads'));
    console.log('清理完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    
    // 清理测试目录
    try {
      await fs.remove(path.join(__dirname, 'test-downloads'));
    } catch (e) {
      // 忽略清理错误
    }
    
    process.exit(1);
  }
}

testDirectoryCreation().catch(console.error);