/**
 * 文件列表模块 - 处理文件列表、目录遍历和扫描
 */

const { getDefaultClient } = require('./http');
const { createFileFilter, matchPattern } = require('./patterns');
const { getDefaultCache } = require('./cache');
const { RepositoryError, ErrorCode, createValidationError } = require('./errors');
const { getLogger } = require('../utils/logger');

const logger = getLogger('Listing');

/**
 * 目录遍历器类 - 使用迭代器模式优化内存使用
 */
class DirectoryWalker {
  constructor(options = {}) {
    this.httpClient = options.httpClient || getDefaultClient();
    this.cache = options.cache || getDefaultCache();
    this.maxDepth = options.maxDepth || 3;
    this.maxFiles = options.maxFiles || 100;
    this.filter = createFileFilter(options.filter || {});
  }

  /**
   * 异步迭代器 - 遍历目录树
   */
  async * walk(repoId, path = '', revision = 'main', token = null, depth = 0) {
    if (depth > this.maxDepth) {
      logger.debug(`达到最大深度 ${this.maxDepth}，停止遍历`);
      return;
    }

    // 设置认证
    if (token) {
      this.httpClient.setAuthToken(token);
    }

    try {
      // 获取当前目录内容
      const items = await this.fetchDirectory(repoId, path, revision);

      for (const item of items) {
        if (item.type === 'file') {
          // 应用过滤器
          const filtered = this.filter([item.path]);
          if (filtered.length > 0) {
            yield {
              ...item,
              depth,
              relativePath: item.path
            };
          }
        } else if (item.type === 'directory') {
          // 递归遍历子目录 - API返回的item.path已经是完整路径
          const subPath = item.path;
          yield * this.walk(repoId, subPath, revision, token, depth + 1);
        }
      }
    } catch (error) {
      logger.error(`遍历目录失败 ${path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取目录内容
   */
  async fetchDirectory(repoId, path = '', revision = 'main') {
    const cacheKey = `dir:${repoId}:${revision}:${path}`;

    // 尝试从缓存获取
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug(`目录缓存命中: ${path || '/'}`);
      return cached;
    }

    // 构建API URL
    const apiUrl = this.buildApiUrl(repoId, path, revision);

    try {
      const response = await this.httpClient.get(apiUrl);
      const items = this.parseDirectoryResponse(response.data);

      // 缓存结果
      this.cache.set(cacheKey, items, 60000); // 缓存1分钟

      return items;
    } catch (error) {
      logger.error(`获取目录失败: ${apiUrl}`);
      throw error;
    }
  }

  /**
   * 构建API URL
   */
  buildApiUrl(repoId, path = '', revision = 'main') {
    const baseUrl = 'https://huggingface.co/api/models';
    // 不对斜杠进行编码，HuggingFace API需要保留路径分隔符
    const encodedPath = path ? `/${path}` : '';
    return `${baseUrl}/${repoId}/tree/${revision}${encodedPath}`;
  }

  /**
   * 解析目录响应
   */
  parseDirectoryResponse(data) {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(item => ({
      type: item.type,
      path: item.path,
      size: item.size,
      oid: item.oid,
      lfs: item.lfs
    }));
  }

  /**
   * 收集所有文件（非迭代器版本）
   */
  async listAllFiles(repoId, options = {}) {
    const files = [];
    const { path = '', revision = 'main', token = null } = options;

    try {
      for await (const file of this.walk(repoId, path, revision, token)) {
        files.push(file);
        if (files.length >= this.maxFiles) {
          logger.info(`达到文件数量限制 ${this.maxFiles}`);
          break;
        }
      }
    } catch (error) {
      logger.error(`列出文件失败: ${error.message}`);
      throw error;
    }

    return files;
  }
}

/**
 * 仓库探索器类 - 分析仓库结构
 */
class RepositoryExplorer {
  constructor(options = {}) {
    this.httpClient = options.httpClient || getDefaultClient();
    this.cache = options.cache || getDefaultCache();
  }

  /**
   * 扫描仓库结构
   */
  async scan(repoId, maxDepth = 3, token = null) {
    const structure = {
      type: 'repository',
      name: repoId,
      children: [],
      stats: {
        totalFiles: 0,
        totalDirectories: 0,
        totalSize: 0,
        maxDepth: 0,
        fileTypes: {}
      }
    };

    if (token) {
      this.httpClient.setAuthToken(token);
    }

    await this.scanDirectory(repoId, '', 'main', structure, 0, maxDepth);

    return structure;
  }

  /**
   * 递归扫描目录
   */
  async scanDirectory(repoId, path, revision, parent, depth, maxDepth) {
    if (depth > maxDepth) {
      return;
    }

    parent.stats.maxDepth = Math.max(parent.stats.maxDepth, depth);

    try {
      const apiUrl = `https://huggingface.co/api/models/${repoId}/tree/${revision}${path ? '/' + path : ''}`;
      const response = await this.httpClient.get(apiUrl);

      if (!Array.isArray(response.data)) {
        return;
      }

      for (const item of response.data) {
        if (item.type === 'file') {
          const fileNode = {
            type: 'file',
            name: item.path.split('/').pop(),
            path: item.path,
            size: item.size,
            lfs: item.lfs
          };

          parent.children.push(fileNode);
          parent.stats.totalFiles++;
          parent.stats.totalSize += item.size || 0;

          // 统计文件类型
          const ext = this.getFileExtension(item.path);
          parent.stats.fileTypes[ext] = (parent.stats.fileTypes[ext] || 0) + 1;
        } else if (item.type === 'directory') {
          const dirNode = {
            type: 'directory',
            name: item.path.split('/').pop(),
            path: item.path,
            children: [],
            stats: parent.stats // 共享统计
          };

          parent.children.push(dirNode);
          parent.stats.totalDirectories++;

          // 递归扫描子目录
          await this.scanDirectory(repoId, item.path, revision, dirNode, depth + 1, maxDepth);
        }
      }
    } catch (error) {
      logger.warn(`扫描目录失败 ${path}: ${error.message}`);
    }
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(path) {
    const parts = path.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : 'no-extension';
  }

  /**
   * 生成目录树可视化
   */
  generateTree(structure, indent = '') {
    let tree = '';
    const isLast = (index, array) => index === array.length - 1;

    structure.children.forEach((child, index) => {
      const prefix = isLast(index, structure.children) ? '└── ' : '├── ';
      const extension = isLast(index, structure.children) ? '    ' : '│   ';

      if (child.type === 'file') {
        const size = this.formatFileSize(child.size);
        tree += `${indent}${prefix}${child.name} (${size})\n`;
      } else {
        tree += `${indent}${prefix}${child.name}/\n`;
        if (child.children && child.children.length > 0) {
          tree += this.generateTree(child, indent + extension);
        }
      }
    });

    return tree;
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (!bytes) return '0B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100}${units[i]}`;
  }
}

/**
 * 文件列表管理器 - 主要接口
 */
class FileListManager {
  constructor(options = {}) {
    this.httpClient = options.httpClient || getDefaultClient();
    this.cache = options.cache || getDefaultCache();
    this.walker = new DirectoryWalker(options);
    this.explorer = new RepositoryExplorer(options);
  }

  /**
   * 列出文件 - 统一接口
   */
  async listFiles(repoId, options = {}) {
    // 参数验证
    this.validateParams(repoId, options);

    // 设置默认值
    const config = this.prepareConfig(options);

    try {
      // 根据模式选择不同的列表策略
      if (config.mode === 'explore') {
        return await this.exploreRepository(repoId, config);
      } else if (config.mode === 'search') {
        return await this.searchFiles(repoId, config);
      } else {
        return await this.standardList(repoId, config);
      }
    } catch (error) {
      logger.error(`列出文件失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 标准文件列表
   */
  async standardList(repoId, config) {
    const startTime = Date.now();

    // 配置walker
    this.walker.maxDepth = config.recursive ? config.maxDepth : 0;
    this.walker.maxFiles = config.maxFiles;
    this.walker.filter = createFileFilter(config.filter);

    // 获取文件列表
    const files = await this.walker.listAllFiles(repoId, {
      path: config.path,
      revision: config.revision,
      token: config.token
    });

    // 排序
    if (config.sort) {
      this.sortFiles(files, config.sort);
    }

    // 生成统计信息
    const stats = this.generateStats(files, config);

    // 生成响应
    return {
      success: true,
      files: files.slice(0, config.maxFiles),
      stats,
      truncated: files.length > config.maxFiles,
      duration: Date.now() - startTime
    };
  }

  /**
   * 探索模式 - 返回目录结构
   */
  async exploreRepository(repoId, config) {
    const startTime = Date.now();

    const structure = await this.explorer.scan(
      repoId,
      config.maxDepth,
      config.token
    );

    // 生成树形视图
    const treeView = config.treeView
      ? this.explorer.generateTree(structure)
      : null;

    return {
      success: true,
      structure,
      treeView,
      stats: structure.stats,
      duration: Date.now() - startTime
    };
  }

  /**
   * 搜索模式 - 查找特定文件
   */
  async searchFiles(repoId, config) {
    const startTime = Date.now();
    const results = [];

    // 使用walker遍历并搜索
    for await (const file of this.walker.walk(repoId, '', config.revision, config.token)) {
      if (this.matchesSearch(file, config.searchQuery)) {
        results.push(file);
        if (results.length >= config.maxFiles) {
          break;
        }
      }
    }

    return {
      success: true,
      query: config.searchQuery,
      files: results, // 保持一致性，使用 files 字段
      count: results.length,
      duration: Date.now() - startTime
    };
  }

  /**
   * 验证参数
   */
  validateParams(repoId, options) {
    if (!repoId) {
      throw createValidationError('repo_id', '仓库ID不能为空');
    }

    // 验证仓库ID格式
    if (!repoId.includes('/')) {
      throw createValidationError('repo_id', '仓库ID格式错误，应为: owner/repo', repoId);
    }

    // 防止路径遍历攻击
    if (repoId.includes('..') || repoId.includes('//')) {
      throw new RepositoryError(
        ErrorCode.PATH_TRAVERSAL,
        '检测到路径遍历尝试',
        { repoId },
        ['请使用有效的仓库ID']
      );
    }

    // 验证数值参数
    if (options.maxFiles && options.maxFiles < 1) {
      throw createValidationError('max_files', '最大文件数必须大于0', options.maxFiles);
    }

    if (options.maxDepth && options.maxDepth < 0) {
      throw createValidationError('max_depth', '最大深度不能为负数', options.maxDepth);
    }
  }

  /**
   * 准备配置
   */
  prepareConfig(options) {
    return {
      path: options.path || '',
      revision: options.revision || 'main',
      token: options.token || process.env.HF_TOKEN,
      recursive: options.recursive !== false,
      maxFiles: options.maxFiles || options.max_files || 100,
      maxDepth: options.maxDepth || options.max_depth || 3,
      sort: options.sort || options.sort_by || 'name',
      mode: options.mode || 'standard',
      treeView: options.tree_view || false,
      searchQuery: options.search_query || options.pattern,
      // 如果已经传递了filter对象，直接使用；否则构建新的
      filter: options.filter || {
        include: options.pattern || options.allow_patterns,
        exclude: options.ignore_patterns,
        maxSize: this.parseSize(options.max_size_per_file),
        minSize: this.parseSize(options.min_size),
        types: options.file_types
      }
    };
  }

  /**
   * 解析文件大小
   */
  parseSize(sizeStr) {
    if (!sizeStr) return undefined;
    if (typeof sizeStr === 'number') return sizeStr;

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?)B?$/i);
    if (!match) return undefined;

    const size = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const multipliers = { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };

    return Math.floor(size * multipliers[unit]);
  }

  /**
   * 排序文件
   */
  sortFiles(files, sortBy) {
    const sorters = {
      name: (a, b) => a.path.localeCompare(b.path),
      size: (a, b) => (b.size || 0) - (a.size || 0),
      type: (a, b) => {
        const extA = a.path.split('.').pop();
        const extB = b.path.split('.').pop();
        return extA.localeCompare(extB);
      }
    };

    const sorter = sorters[sortBy] || sorters.name;
    files.sort(sorter);
  }

  /**
   * 生成统计信息
   */
  generateStats(files, config) {
    const stats = {
      returned_files: files.length,
      total_files: files.length,
      total_size: files.reduce((sum, f) => sum + (f.size || 0), 0),
      file_types: {},
      directories: new Set()
    };

    // 统计文件类型
    files.forEach(file => {
      const ext = file.path.split('.').pop();
      stats.file_types[ext] = (stats.file_types[ext] || 0) + 1;

      const dir = file.path.split('/').slice(0, -1).join('/');
      if (dir) {
        stats.directories.add(dir);
      }
    });

    stats.directory_count = stats.directories.size;
    delete stats.directories; // 不返回集合

    return stats;
  }

  /**
   * 匹配搜索条件
   */
  matchesSearch(file, query) {
    if (!query) return true;

    const path = file.path.toLowerCase();
    const queryLower = query.toLowerCase();

    // 支持简单的通配符
    if (query.includes('*')) {
      return matchPattern(file.path, query);
    }

    // 普通文本搜索
    return path.includes(queryLower);
  }
}

/**
 * 创建文件列表管理器
 */
function createFileListManager(options) {
  return new FileListManager(options);
}

module.exports = {
  DirectoryWalker,
  RepositoryExplorer,
  FileListManager,
  createFileListManager
};
