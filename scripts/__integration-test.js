#!/usr/bin/env node

/**
 * 集成测试：测试重构后的完整功能
 */

const { spawn } = require('child_process');

// 启动 MCP 服务器并发送测试命令
async function testMCPServer() {
  console.log('测试 MCP 服务器集成...\n');

  const testCases = [
    {
      name: '初始化服务器',
      request: {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {}
        },
        id: 0
      }
    },
    {
      name: '获取工具列表',
      request: {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      }
    },
    {
      name: '调用 list_huggingface_files（探索模式）',
      request: {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'list_huggingface_files',
          arguments: {
            repo_id: 'hf-internal-testing/tiny-random-bert',
            explore_mode: true,
            max_depth: 2
          }
        },
        id: 2
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n测试: ${testCase.name}`);
    console.log('请求:', JSON.stringify(testCase.request, null, 2));

    const server = spawn('node', ['bin/claude-compatible.js'], {
      stdio: ['pipe', 'pipe', 'ignore']
    });

    // 发送请求
    server.stdin.write(JSON.stringify(testCase.request) + '\n');
    server.stdin.end();

    // 收集响应
    let response = '';
    server.stdout.on('data', (data) => {
      response += data.toString();
    });

    // 等待服务器响应
    await new Promise((resolve) => {
      server.on('close', () => {
        resolve();
      });
    });

    // 解析响应
    try {
      const lines = response.trim().split('\n');
      for (const line of lines) {
        try {
          const jsonResponse = JSON.parse(line);

          if (jsonResponse.result) {
            console.log('✓ 成功响应');

            // 根据测试类型显示不同信息
            if (testCase.name === '获取工具列表' && jsonResponse.result.tools) {
              console.log(`  发现 ${jsonResponse.result.tools.length} 个工具:`);
              jsonResponse.result.tools.forEach(tool => {
                console.log(`    - ${tool.name}`);
              });
            } else if (testCase.name.includes('list_huggingface_files')) {
              const content = jsonResponse.result.content;
              if (content && content[0] && content[0].text) {
                const result = JSON.parse(content[0].text);
                if (result.success) {
                  console.log('  文件列表获取成功');
                  if (result.mode === 'explore') {
                    console.log('  探索模式已启用');
                    if (result.directory_tree) {
                      const dirs = Object.keys(result.directory_tree);
                      console.log(`  发现 ${dirs.length} 个目录`);
                    }
                  }
                  if (result.stats) {
                    console.log(`  统计: ${result.stats.returned_files} 个文件, ${result.stats.total_directories} 个目录`);
                  }
                }
              }
            }
          } else if (jsonResponse.error) {
            console.log('✗ 错误响应:', jsonResponse.error.message);
          }
        } catch (e) {
          // 忽略非 JSON 行
        }
      }
    } catch (error) {
      console.log('✗ 解析响应失败:', error.message);
    }
  }

  console.log('\n\n集成测试完成！');
}

// 运行测试
testMCPServer().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});