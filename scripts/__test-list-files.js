#!/usr/bin/env node

/**
 * 测试脚本：验证文件列表功能的各项优化
 */

const { HuggingFaceDownloader } = require('../src/core/downloader');
const { getConfig } = require('../src/core/config');
const { createLogger } = require('../src/utils/logger');

const logger = createLogger();
const downloader = new HuggingFaceDownloader();

// 测试配置
const TEST_REPOS = [
  {
    name: '小型仓库',
    repo_id: 'hf-internal-testing/tiny-random-bert',
    description: '测试基本递归功能'
  },
  {
    name: '包含子目录的仓库',
    repo_id: 'coreml-community/coreml-animagine-xl-3.1',
    description: '测试子目录递归获取'
  }
];

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(color, label, message) {
  console.log(`${color}${label}${colors.reset} ${message}`);
}

function logSection(title) {
  console.log(`\n${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

function logSubSection(title) {
  console.log(`\n${colors.cyan}--- ${title} ---${colors.reset}\n`);
}

// 测试用例
async function runTests() {
  const config = getConfig();

  logSection('开始测试文件列表功能优化');

  for (const testRepo of TEST_REPOS) {
    logSection(`测试仓库: ${testRepo.name}`);
    log(colors.yellow, '仓库ID:', testRepo.repo_id);
    log(colors.yellow, '描述:', testRepo.description);

    // 测试1：基本递归功能
    logSubSection('测试1：基本递归功能（默认参数）');
    try {
      const result1 = await downloader.listFiles({
        repo_id: testRepo.repo_id
      }, config);

      if (result1.success) {
        log(colors.green, '✓ 成功', '基本递归功能正常');
        log(colors.cyan, '  统计信息:', JSON.stringify(result1.stats, null, 2));
        log(colors.cyan, '  文件数:', `${result1.stats.returned_files}/${result1.stats.total_files}`);
        log(colors.cyan, '  目录数:', result1.stats.total_directories);
        log(colors.cyan, '  扫描时间:', result1.stats.scan_time);

        if (result1.limits_reached.truncated_paths && result1.limits_reached.truncated_paths.length > 0) {
          log(colors.yellow, '  截断路径:', result1.limits_reached.truncated_paths.join(', '));
        }

        // 显示前3个文件
        if (result1.files.length > 0) {
          log(colors.cyan, '  前3个文件:');
          result1.files.slice(0, 3).forEach(file => {
            console.log(`    - ${file.path} (${file.size})`);
          });
        }
      } else {
        log(colors.red, '✗ 失败', result1.error);
      }
    } catch (error) {
      log(colors.red, '✗ 异常', error.message);
    }

    // 测试2：探索模式
    logSubSection('测试2：探索模式');
    try {
      const result2 = await downloader.listFiles({
        repo_id: testRepo.repo_id,
        explore_mode: true,
        max_depth: 2
      }, config);

      if (result2.success) {
        log(colors.green, '✓ 成功', '探索模式正常');
        log(colors.cyan, '  模式:', result2.mode);

        if (result2.directory_tree) {
          const dirs = Object.keys(result2.directory_tree);
          log(colors.cyan, '  发现目录数:', dirs.length);
          if (dirs.length > 0) {
            log(colors.cyan, '  目录结构:');
            dirs.slice(0, 5).forEach(dir => {
              const info = result2.directory_tree[dir];
              console.log(`    - ${dir}: ${info.file_count}个文件, ${info.total_size_formatted || '0B'}`);
            });
          }
        }
      } else {
        log(colors.red, '✗ 失败', result2.error);
      }
    } catch (error) {
      log(colors.red, '✗ 异常', error.message);
    }

    // 测试3：限制参数
    logSubSection('测试3：限制参数（max_files=5, max_depth=1）');
    try {
      const result3 = await downloader.listFiles({
        repo_id: testRepo.repo_id,
        max_files: 5,
        max_depth: 1
      }, config);

      if (result3.success) {
        log(colors.green, '✓ 成功', '限制参数正常');
        log(colors.cyan, '  返回文件数:', result3.files.length);
        log(colors.cyan, '  达到文件数限制:', result3.limits_reached.max_files ? '是' : '否');
        log(colors.cyan, '  达到深度限制:', result3.limits_reached.max_depth ? '是' : '否');

        if (result3.suggestions && result3.suggestions.next_actions.length > 0) {
          log(colors.yellow, '  智能建议:');
          result3.suggestions.next_actions.forEach(action => {
            console.log(`    • ${action}`);
          });
        }
      } else {
        log(colors.red, '✗ 失败', result3.error);
      }
    } catch (error) {
      log(colors.red, '✗ 异常', error.message);
    }

    // 测试4：过滤功能
    logSubSection('测试4：过滤功能（pattern=*.md）');
    try {
      const result4 = await downloader.listFiles({
        repo_id: testRepo.repo_id,
        pattern: '*.md',
        recursive: true
      }, config);

      if (result4.success) {
        log(colors.green, '✓ 成功', '过滤功能正常');
        log(colors.cyan, '  匹配文件数:', result4.files.length);

        if (result4.files.length > 0) {
          log(colors.cyan, '  匹配的文件:');
          result4.files.forEach(file => {
            console.log(`    - ${file.path}`);
          });
        }
      } else {
        log(colors.red, '✗ 失败', result4.error);
      }
    } catch (error) {
      log(colors.red, '✗ 异常', error.message);
    }

    // 测试5：不递归模式
    logSubSection('测试5：不递归模式（recursive=false）');
    try {
      const result5 = await downloader.listFiles({
        repo_id: testRepo.repo_id,
        recursive: false
      }, config);

      if (result5.success) {
        log(colors.green, '✓ 成功', '不递归模式正常');
        log(colors.cyan, '  根目录文件数:', result5.files.length);
        log(colors.cyan, '  根目录目录数:', result5.directories ? result5.directories.length : 0);
      } else {
        log(colors.red, '✗ 失败', result5.error);
      }
    } catch (error) {
      log(colors.red, '✗ 异常', error.message);
    }

    console.log(''); // 空行分隔
  }

  logSection('测试完成');
}

// 运行测试
(async() => {
  try {
    await runTests();
  } catch (error) {
    console.error(`${colors.red}测试运行失败:${colors.reset}`, error);
    process.exit(1);
  }
})();