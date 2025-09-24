/**
 * HuggingFace 下载器 - 精简版
 * 不考虑向后兼容的简化实现
 */

// 导入核心模块
const { createFileListManager } = require('./listing');
const { createDownloadManager } = require('./download');
const { createHttpClient } = require('./http');
const { getDefaultCache } = require('./cache');
const { quickSuggestions } = require('./suggestions');
const { RepositoryError, ErrorCode, mapHttpError } = require('./errors');

// 辅助工具
const { ensureDirectory, formatSize, formatDuration } = require('../utils/helpers');

/**
 * 简化的下载选项接口
 */
const DEFAULT_OPTIONS = {
  revision: 'main',
  maxFiles: 100,
  maxDepth: 3,
  maxConcurrent: 5,
  sort: 'name'
};

/**
 * HuggingFace 下载器 - 精简版
 */
class HuggingFaceDownloader {
  constructor() {
    // 初始化组件
    this.http = createHttpClient({
      version: '1.3.0',
      maxRetries: 5
    });

    this.cache = getDefaultCache();
    this.listManager = createFileListManager({
      httpClient: this.http,
      cache: this.cache
    });

    this.downloadManager = createDownloadManager({
      httpClient: this.http,
      maxConcurrent: 5
    });
  }

  /**
   * 列出文件 - 简化接口
   * @param {string} repoId - 仓库ID
   * @param {object} options - 选项
   */
  async list(repoId, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // 设置认证
    if (opts.token || process.env.HF_TOKEN) {
      this.http.setAuthToken(opts.token || process.env.HF_TOKEN);
    }

    try {
      // 创建过滤器选项（不是函数）
      const filterOptions = {
        include: opts.pattern,
        exclude: opts.exclude,
        maxSize: opts.maxSize,
        types: opts.types
      };

      // 获取文件列表
      const result = await this.listManager.listFiles(repoId, {
        revision: opts.revision,
        maxFiles: opts.maxFiles,
        maxDepth: opts.maxDepth,
        recursive: opts.recursive !== false,
        filter: filterOptions,
        sort: opts.sort,
        mode: opts.mode || 'standard'
      });

      // 添加建议
      if (result.files) {
        result.suggestions = quickSuggestions({
          files: result.files,
          stats: result.stats,
          options: opts
        });
      }

      return result;
    } catch (error) {
      const repoError = error instanceof RepositoryError ? error : mapHttpError(error);
      return {
        success: false,
        error: repoError.toJSON(),
        suggestions: quickSuggestions({ error: repoError })
      };
    }
  }

  /**
   * 下载文件 - 简化接口
   * @param {string} repoId - 仓库ID
   * @param {string} targetDir - 目标目录
   * @param {object} options - 选项
   */
  async download(repoId, targetDir, options = {}) {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // 设置认证
    if (opts.token || process.env.HF_TOKEN) {
      this.http.setAuthToken(opts.token || process.env.HF_TOKEN);
    }

    try {
      // 确保目标目录存在
      await ensureDirectory(targetDir);

      // 获取文件列表
      const listResult = await this.list(repoId, opts);

      if (!listResult.success || !listResult.files?.length) {
        throw new RepositoryError(
          ErrorCode.NOT_FOUND,
          '未找到符合条件的文件',
          { repoId },
          ['检查仓库ID和过滤条件']
        );
      }

      // 下载文件
      const downloadResult = await this.downloadManager.downloadFiles(
        repoId,
        listResult.files,
        targetDir,
        {
          revision: opts.revision,
          maxConcurrent: opts.maxConcurrent,
          forceRedownload: opts.force,
          onProgress: opts.onProgress
        }
      );

      // 计算统计
      const duration = Date.now() - startTime;
      const totalSize = listResult.files.reduce((sum, f) => sum + (f.size || 0), 0);

      return {
        success: downloadResult.success,
        path: targetDir,
        files: downloadResult.stats.completedFiles,
        size: formatSize(totalSize),
        duration: formatDuration(duration),
        stats: { ...listResult.stats, ...downloadResult.stats },
        suggestions: quickSuggestions({
          files: listResult.files,
          stats: listResult.stats,
          download: downloadResult.stats
        })
      };
    } catch (error) {
      const repoError = error instanceof RepositoryError ? error : mapHttpError(error);

      return {
        success: false,
        error: repoError.toJSON(),
        suggestions: quickSuggestions({ error: repoError })
      };
    }
  }

  /**
   * 探索仓库结构
   * @param {string} repoId - 仓库ID
   * @param {object} options - 选项
   */
  async explore(repoId, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (opts.token || process.env.HF_TOKEN) {
      this.http.setAuthToken(opts.token || process.env.HF_TOKEN);
    }

    return await this.listManager.listFiles(repoId, {
      revision: opts.revision,
      mode: 'explore',
      maxDepth: opts.maxDepth,
      treeView: opts.tree
    });
  }

  /**
   * 获取仓库信息
   * @param {string} repoId - 仓库ID
   * @param {object} options - 选项
   */
  async info(repoId, options = {}) {
    if (options.token || process.env.HF_TOKEN) {
      this.http.setAuthToken(options.token || process.env.HF_TOKEN);
    }

    try {
      const response = await this.http.get(
        `https://huggingface.co/api/models/${repoId}`
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const repoError = mapHttpError(error);
      return {
        success: false,
        error: repoError.toJSON()
      };
    }
  }

  /**
   * 搜索文件
   * @param {string} repoId - 仓库ID
   * @param {string} query - 搜索查询
   * @param {object} options - 选项
   */
  async search(repoId, query, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    return await this.list(repoId, {
      ...opts,
      pattern: query,
      mode: 'search'
    });
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.cache) {
      this.cache.stop();
    }
  }
}

/**
 * 创建下载器实例
 */
function createDownloader() {
  return new HuggingFaceDownloader();
}

// 导出
module.exports = {
  HuggingFaceDownloader,
  createDownloader,
  DEFAULT_OPTIONS
};
