#!/usr/bin/env node

/**
 * 直接测试文件列表功能
 */

const { HuggingFaceDownloader } = require('../src/core/downloader');
const { getConfig } = require('../src/core/config');

async function testListDirectly() {
  console.log('=== 直接测试文件列表功能 ===\n');
  
  try {
    const downloader = new HuggingFaceDownloader();
    const config = getConfig();
    
    // 验证配置
    try {
      await config.validate();
      console.log('✓ 配置验证成功\n');
    } catch (error) {
      console.error('✗ 配置验证失败:', error.message);
      console.log('\n请确保设置了 HUGGINGFACE_TOKEN 环境变量');
      process.exit(1);
    }
    
    // 测试1: 列出小型仓库文件
    console.log('测试 1: 列出 sentence-transformers/all-MiniLM-L6-v2 文件');
    console.log('-'.repeat(60));
    
    const result1 = await downloader.listFiles({
      repo_id: 'sentence-transformers/all-MiniLM-L6-v2',
      sort_by: 'size'
    }, config);
    
    if (result1.success) {
      console.log(`✓ 成功获取文件列表`);
      console.log(`  仓库: ${result1.repo_id}`);
      console.log(`  总文件数: ${result1.total_files}`);
      console.log(`  总大小: ${result1.total_size}`);
      
      console.log('\n  前5个最大的文件:');
      result1.files.slice(0, 5).forEach((file, idx) => {
        console.log(`    ${idx + 1}. ${file.path}`);
        console.log(`       大小: ${file.size}, 类型: ${file.type}`);
      });
      
      if (result1.statistics) {
        console.log('\n  文件类型统计:');
        result1.statistics.forEach(stat => {
          console.log(`    - ${stat.type}: ${stat.count} 个文件, ${stat.size}`);
        });
      }
    } else {
      console.log(`✗ 获取失败: ${result1.error}`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 测试2: 使用 pattern 过滤
    console.log('测试 2: 使用 pattern 过滤 *.json 文件');
    console.log('-'.repeat(60));
    
    const result2 = await downloader.listFiles({
      repo_id: 'bert-base-uncased',
      pattern: '*.json',
      sort_by: 'name'
    }, config);
    
    if (result2.success) {
      console.log(`✓ 成功过滤 JSON 文件`);
      console.log(`  找到 ${result2.total_files} 个 JSON 文件`);
      console.log('\n  JSON 文件列表:');
      result2.files.forEach((file, idx) => {
        console.log(`    ${idx + 1}. ${file.path} (${file.size})`);
      });
    } else {
      console.log(`✗ 获取失败: ${result2.error}`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 测试3: 测试不存在的仓库
    console.log('测试 3: 测试错误处理（不存在的仓库）');
    console.log('-'.repeat(60));
    
    const result3 = await downloader.listFiles({
      repo_id: 'this-repo-does-not-exist-99999'
    }, config);
    
    if (!result3.success) {
      console.log(`✓ 正确处理错误: ${result3.error}`);
    } else {
      console.log('✗ 应该返回错误但没有');
    }
    
    console.log('\n=== 所有测试完成 ===');
    
  } catch (error) {
    console.error('\n测试过程中出错:', error);
    process.exit(1);
  }
}

// 运行测试
testListDirectly().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});