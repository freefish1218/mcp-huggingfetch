#!/usr/bin/env node

/**
 * 测试文件列表工具
 * 用于验证 list_huggingface_files 工具的功能
 */

const { McpServer } = require('../src/mcp/server');
const { createLogger } = require('../src/utils/logger');

const logger = createLogger();

async function testListTool() {
  console.log('=== 测试文件列表工具 ===\n');
  
  try {
    // 创建 MCP 服务器实例
    const server = new McpServer();
    
    // 测试用例1: 列出小型仓库的所有文件
    console.log('测试用例 1: 列出 sentence-transformers/all-MiniLM-L6-v2 仓库文件');
    console.log('-'.repeat(60));
    
    const request1 = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'list_huggingface_files',
        arguments: {
          repo_id: 'sentence-transformers/all-MiniLM-L6-v2',
          sort_by: 'size'
        }
      }
    };
    
    const response1 = await server.handleRequest(request1);
    if (response1.result?.content?.[0]?.text) {
      const result = JSON.parse(response1.result.content[0].text);
      console.log(`仓库: ${result.repo_id}`);
      console.log(`总文件数: ${result.total_files}`);
      console.log(`总大小: ${result.total_size}`);
      console.log('\n前5个最大的文件:');
      result.files.slice(0, 5).forEach((file, idx) => {
        console.log(`  ${idx + 1}. ${file.path} (${file.size}, ${file.type})`);
      });
      
      if (result.statistics) {
        console.log('\n文件类型统计:');
        result.statistics.forEach(stat => {
          console.log(`  - ${stat.type}: ${stat.count} 个文件, 总大小 ${stat.size}`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 测试用例2: 使用 pattern 过滤文件
    console.log('测试用例 2: 使用 pattern 过滤 JSON 文件');
    console.log('-'.repeat(60));
    
    const request2 = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_huggingface_files',
        arguments: {
          repo_id: 'bert-base-uncased',
          pattern: '*.json',
          sort_by: 'name'
        }
      }
    };
    
    const response2 = await server.handleRequest(request2);
    if (response2.result?.content?.[0]?.text) {
      const result = JSON.parse(response2.result.content[0].text);
      console.log(`仓库: ${result.repo_id}`);
      console.log(`JSON 文件数: ${result.total_files}`);
      console.log('\nJSON 文件列表:');
      result.files.forEach((file, idx) => {
        console.log(`  ${idx + 1}. ${file.path} (${file.size})`);
      });
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 测试用例3: 测试错误处理
    console.log('测试用例 3: 测试错误处理（不存在的仓库）');
    console.log('-'.repeat(60));
    
    const request3 = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'list_huggingface_files',
        arguments: {
          repo_id: 'this-repo-does-not-exist-12345'
        }
      }
    };
    
    const response3 = await server.handleRequest(request3);
    if (response3.result?.content?.[0]?.text) {
      const text = response3.result.content[0].text;
      if (text.includes('失败')) {
        console.log('✓ 错误处理正常:', text);
      } else {
        console.log('✗ 未正确处理错误');
      }
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testListTool().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});