#!/usr/bin/env node

/**
 * 测试拆分后的MCP工具
 */

const { HuggingFetchTools } = require('../src/mcp/tools');

// 测试仓库
const TEST_REPO = 'hf-internal-testing/tiny-random-bert';

async function runTests() {
  console.log('🚀 测试拆分后的MCP工具\n');

  const tools = new HuggingFetchTools();
  const results = {
    passed: 0,
    failed: 0
  };

  // 测试1: list_huggingface_files
  console.log('📋 测试 list_huggingface_files...');
  try {
    const result = await tools.callTool('list_huggingface_files', {
      repo_id: TEST_REPO,
      pattern: '*.json',
      max_files: 5
    });

    // CallToolResult: isError=true表示失败，否则成功
    const resultData = result.content ? JSON.parse(result.content[0].text) : null;

    if (!result.isError && resultData?.success) {
      console.log(`  ✅ 成功 - 找到 ${resultData.files?.length || 0} 个JSON文件`);
      results.passed++;
    } else {
      console.log(`  ❌ 失败`);
      if (result.isError) {
        console.error('工具调用失败:', result.content[0].text);
      } else {
        console.error('结果数据异常:', resultData);
      }
      results.failed++;
    }
  } catch (error) {
    console.log(`  ❌ 异常 - ${error.message}`);
    results.failed++;
  }

  // 测试2: explore_huggingface_repo
  console.log('\n🔍 测试 explore_huggingface_repo...');
  try {
    const result = await tools.callTool('explore_huggingface_repo', {
      repo_id: TEST_REPO,
      max_depth: 2,
      tree_view: true
    });

    const resultData = result.content ? JSON.parse(result.content[0].text) : null;

    if (!result.isError && resultData?.success) {
      console.log(`  ✅ 成功 - 探索深度 ${resultData.stats?.maxDepth || 0}`);
      if (resultData.treeView) {
        console.log('  📁 目录树:\n' + resultData.treeView.split('\n').map(l => '    ' + l).join('\n'));
      }
      results.passed++;
    } else {
      console.log(`  ❌ 失败`);
      if (result.isError) {
        console.error('工具调用失败:', result.content[0].text);
      } else {
        console.error('结果数据异常:', resultData);
      }
      results.failed++;
    }
  } catch (error) {
    console.log(`  ❌ 异常 - ${error.message}`);
    results.failed++;
  }

  // 测试3: search_huggingface_files
  console.log('\n🔎 测试 search_huggingface_files...');
  try {
    const result = await tools.callTool('search_huggingface_files', {
      repo_id: TEST_REPO,
      query: 'config',
      max_results: 3
    });

    const resultData = result.content ? JSON.parse(result.content[0].text) : null;

    if (!result.isError && resultData?.success) {
      console.log(`  ✅ 成功 - 找到 ${resultData.files?.length || 0} 个匹配文件`);
      resultData.files?.slice(0, 3).forEach(f => {
        console.log(`    - ${f.path}`);
      });
      results.passed++;
    } else {
      console.log(`  ❌ 失败`);
      if (result.isError) {
        console.error('工具调用失败:', result.content[0].text);
      } else {
        console.error('结果数据异常:', resultData);
      }
      results.failed++;
    }
  } catch (error) {
    console.log(`  ❌ 异常 - ${error.message}`);
    results.failed++;
  }

  // 测试4: 验证旧工具已移除mode参数
  console.log('\n🔧 测试工具参数验证...');
  try {
    // 获取工具定义
    const tools_list = tools.getTools();
    const listTool = tools_list.find(t => t.name === 'list_huggingface_files');

    if (listTool && !listTool.inputSchema.properties.mode) {
      console.log('  ✅ list_huggingface_files 已移除 mode 参数');
      results.passed++;
    } else {
      console.log('  ❌ list_huggingface_files 仍包含 mode 参数');
      results.failed++;
    }
  } catch (error) {
    console.log(`  ❌ 异常 - ${error.message}`);
    results.failed++;
  }

  // 测试5: 测试未知工具处理
  console.log('\n❓ 测试未知工具处理...');
  try {
    const result = await tools.callTool('unknown_tool', {});

    if (result.isError) {
      console.log('  ✅ 正确处理未知工具');
      results.passed++;
    } else {
      console.log('  ❌ 未能正确处理未知工具');
      results.failed++;
    }
  } catch (error) {
    console.log(`  ❌ 异常 - ${error.message}`);
    results.failed++;
  }

  // 总结
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果');
  console.log('='.repeat(50));
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  const successRate = Math.round(results.passed / (results.passed + results.failed) * 100);
  console.log(`📈 成功率: ${successRate}%`);

  // 返回状态码
  process.exit(results.failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});