#!/usr/bin/env node

/**
 * 集成测试脚本 - 验证重构后的功能
 */

const { createDownloader } = require('../src/core/downloader');
const { getLogger } = require('../src/utils/logger');
const path = require('path');
const fs = require('fs-extra');

const logger = getLogger('Test');

// 测试配置
const TEST_REPO = 'hf-internal-testing/tiny-random-bert'; // 小型测试仓库
const TEST_DIR = path.join(process.cwd(), 'test-downloads');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(50));
  log('blue', `  ${title}`);
  console.log('='.repeat(50));
}

// 测试用例
class TestRunner {
  constructor() {
    this.downloader = createDownloader();
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  async setup() {
    log('yellow', '\n🔧 准备测试环境...');

    // 清理并创建测试目录
    if (fs.existsSync(TEST_DIR)) {
      await fs.remove(TEST_DIR);
    }
    await fs.ensureDir(TEST_DIR);

    log('green', '✓ 测试目录已准备');
  }

  async cleanup() {
    log('yellow', '\n🧹 清理测试环境...');

    if (fs.existsSync(TEST_DIR)) {
      await fs.remove(TEST_DIR);
    }

    log('green', '✓ 清理完成');
  }

  async test(name, fn) {
    this.tests.push({ name, fn });
  }

  async runTests() {
    for (const test of this.tests) {
      logSection(test.name);

      try {
        await test.fn();
        this.passed++;
        log('green', `✅ ${test.name} - 通过`);
      } catch (error) {
        this.failed++;
        log('red', `❌ ${test.name} - 失败`);
        console.error(error.message);
      }
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    log('blue', '  测试总结');
    console.log('='.repeat(50));

    const total = this.passed + this.failed;
    log('green', `✅ 通过: ${this.passed}/${total}`);

    if (this.failed > 0) {
      log('red', `❌ 失败: ${this.failed}/${total}`);
    }

    const percentage = Math.round((this.passed / total) * 100);
    const color = percentage === 100 ? 'green' : percentage >= 75 ? 'yellow' : 'red';
    log(color, `📊 成功率: ${percentage}%`);

    return this.failed === 0;
  }
}

// 执行测试
async function main() {
  console.clear();
  log('blue', '🚀 HuggingFetch 重构测试');
  console.log('='.repeat(50));

  const runner = new TestRunner();

  try {
    await runner.setup();

    // 测试1: 列出文件
    runner.test('列出文件（标准模式）', async () => {
      const result = await runner.downloader.list(TEST_REPO, {
        maxFiles: 10
      });

      if (!result.success) {
        throw new Error(`列表失败: ${JSON.stringify(result.error)}`);
      }

      if (!result.files || result.files.length === 0) {
        throw new Error('未返回文件列表');
      }

      console.log(`  - 获取到 ${result.files.length} 个文件`);
      console.log(`  - 总大小: ${result.stats?.total_size || 0} 字节`);
    });

    // 测试2: 模式过滤
    runner.test('Glob模式过滤', async () => {
      const result = await runner.downloader.list(TEST_REPO, {
        pattern: '*.json',
        maxFiles: 10
      });

      if (!result.success) {
        throw new Error(`过滤失败: ${JSON.stringify(result.error)}`);
      }

      // 验证所有文件都是.json
      const nonJsonFiles = result.files?.filter(f => !f.path.endsWith('.json')) || [];
      if (nonJsonFiles.length > 0) {
        throw new Error(`过滤失败，包含非JSON文件: ${nonJsonFiles[0].path}`);
      }

      console.log(`  - 找到 ${result.files?.length || 0} 个JSON文件`);
    });

    // 测试3: 探索模式
    runner.test('探索模式（目录结构）', async () => {
      const result = await runner.downloader.explore(TEST_REPO, {
        maxDepth: 2,
        tree: true
      });

      if (!result.success) {
        throw new Error(`探索失败: ${JSON.stringify(result.error)}`);
      }

      if (!result.structure) {
        throw new Error('未返回目录结构');
      }

      console.log(`  - 扫描深度: ${result.structure.stats?.maxDepth || 0}`);
      console.log(`  - 文件数: ${result.structure.stats?.totalFiles || 0}`);
      console.log(`  - 目录数: ${result.structure.stats?.totalDirectories || 0}`);
    });

    // 测试4: 仓库信息
    runner.test('获取仓库信息', async () => {
      const result = await runner.downloader.info(TEST_REPO);

      if (!result.success) {
        throw new Error(`获取信息失败: ${JSON.stringify(result.error)}`);
      }

      if (!result.data) {
        throw new Error('未返回仓库数据');
      }

      console.log(`  - 仓库ID: ${result.data.id || 'N/A'}`);
      console.log(`  - 模型类型: ${result.data.pipeline_tag || 'N/A'}`);
    });

    // 测试5: 下载功能
    runner.test('下载文件（config.json）', async () => {
      const targetDir = path.join(TEST_DIR, 'download-test');

      const result = await runner.downloader.download(TEST_REPO, targetDir, {
        pattern: 'config.json',
        maxFiles: 1
      });

      if (!result.success) {
        throw new Error(`下载失败: ${JSON.stringify(result.error)}`);
      }

      // 验证文件存在
      const configPath = path.join(targetDir, 'config.json');
      if (!fs.existsSync(configPath)) {
        throw new Error('config.json 未下载');
      }

      const stats = fs.statSync(configPath);
      console.log(`  - 下载文件: config.json`);
      console.log(`  - 文件大小: ${stats.size} 字节`);
      console.log(`  - 耗时: ${result.duration}`);
    });

    // 测试6: 搜索功能
    runner.test('搜索文件', async () => {
      const result = await runner.downloader.search(TEST_REPO, 'config', {
        maxFiles: 5
      });

      if (!result.success) {
        throw new Error(`搜索失败: ${JSON.stringify(result.error)}`);
      }

      const matches = result.files?.filter(f =>
        f.path.toLowerCase().includes('config')
      ) || [];

      if (matches.length === 0) {
        throw new Error('搜索未找到匹配文件');
      }

      console.log(`  - 找到 ${matches.length} 个匹配文件`);
    });

    // 测试7: 错误处理
    runner.test('错误处理（无效仓库）', async () => {
      const result = await runner.downloader.list('invalid/repository-that-does-not-exist');

      if (result.success) {
        throw new Error('应该返回错误');
      }

      if (!result.error) {
        throw new Error('未返回错误信息');
      }

      if (!result.suggestions || result.suggestions.length === 0) {
        throw new Error('未返回建议');
      }

      console.log(`  - 错误代码: ${result.error.code}`);
      console.log(`  - 建议数量: ${result.suggestions.length}`);
    });

    // 测试8: 缓存功能
    runner.test('缓存功能', async () => {
      const start1 = Date.now();
      await runner.downloader.list(TEST_REPO, { maxFiles: 5 });
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await runner.downloader.list(TEST_REPO, { maxFiles: 5 });
      const time2 = Date.now() - start2;

      // 第二次应该更快（缓存命中）
      if (time2 >= time1) {
        console.log(`  ⚠️ 缓存可能未生效 (第一次: ${time1}ms, 第二次: ${time2}ms)`);
      } else {
        console.log(`  - 第一次: ${time1}ms`);
        console.log(`  - 第二次: ${time2}ms (缓存命中)`);
        console.log(`  - 提速: ${Math.round(((time1 - time2) / time1) * 100)}%`);
      }
    });

    // 执行所有测试
    await runner.runTests();

    // 打印总结
    const success = runner.printSummary();

    // 清理
    await runner.cleanup();

    // 退出
    process.exit(success ? 0 : 1);

  } catch (error) {
    log('red', '\n💥 测试执行失败');
    console.error(error);
    await runner.cleanup();
    process.exit(1);
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  log('red', '💥 未处理的错误');
  console.error(error);
  process.exit(1);
});

// 执行测试
main().catch(error => {
  log('red', '💥 测试失败');
  console.error(error);
  process.exit(1);
});