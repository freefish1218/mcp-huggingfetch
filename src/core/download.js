/**
 * 下载管理模块 - 处理文件下载、队列管理、断点续传
 */

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { getDefaultClient } = require('./http');
const { getLogger } = require('../utils/logger');

const logger = getLogger('Download');

/**
 * 下载进度类
 */
class DownloadProgress {
  constructor() {
    this.totalFiles = 0;
    this.completedFiles = 0;
    this.failedFiles = 0;
    this.totalBytes = 0;
    this.downloadedBytes = 0;
    this.startTime = Date.now();
    this.currentFile = null;
    this.errors = [];
  }

  /**
   * 更新进度
   */
  update(bytes) {
    this.downloadedBytes += bytes;
  }

  /**
   * 文件完成
   */
  fileCompleted(file, success = true) {
    if (success) {
      this.completedFiles++;
    } else {
      this.failedFiles++;
    }
  }

  /**
   * 获取进度百分比
   */
  getPercentage() {
    if (this.totalBytes === 0) return 0;
    return Math.round((this.downloadedBytes / this.totalBytes) * 100);
  }

  /**
   * 获取下载速度（字节/秒）
   */
  getSpeed() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return elapsed > 0 ? Math.round(this.downloadedBytes / elapsed) : 0;
  }

  /**
   * 获取剩余时间（秒）
   */
  getETA() {
    const speed = this.getSpeed();
    if (speed === 0) return Infinity;
    const remaining = this.totalBytes - this.downloadedBytes;
    return Math.round(remaining / speed);
  }

  /**
   * 格式化进度信息
   */
  toString() {
    const percentage = this.getPercentage();
    const speed = this.formatBytes(this.getSpeed());
    const eta = this.formatTime(this.getETA());

    return `进度: ${percentage}% | 速度: ${speed}/s | 剩余: ${eta} | ` +
           `文件: ${this.completedFiles}/${this.totalFiles} | ` +
           `失败: ${this.failedFiles}`;
  }

  /**
   * 格式化字节
   */
  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  /**
   * 格式化时间
   */
  formatTime(seconds) {
    if (!isFinite(seconds)) return '未知';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    return `${Math.floor(seconds / 3600)}小时`;
  }
}

/**
 * 下载任务类
 */
class DownloadTask {
  constructor(file, targetDir, options = {}) {
    this.file = file;
    this.targetDir = targetDir;
    this.targetPath = path.join(targetDir, file.path);
    this.tempPath = `${this.targetPath}.download`;
    this.options = options;
    this.retries = 0;
    this.maxRetries = options.maxRetries || 3;
    this.status = 'pending'; // pending, downloading, completed, failed
    this.error = null;
    this.downloadedBytes = 0;
  }

  /**
   * 检查是否已下载
   */
  isCompleted() {
    try {
      if (!fs.existsSync(this.targetPath)) {
        return false;
      }
      const stats = fs.statSync(this.targetPath);
      return stats.size === this.file.size;
    } catch {
      return false;
    }
  }

  /**
   * 获取已下载大小（用于断点续传）
   */
  getDownloadedSize() {
    try {
      if (fs.existsSync(this.tempPath)) {
        const stats = fs.statSync(this.tempPath);
        return stats.size;
      }
    } catch {
      // 忽略错误
    }
    return 0;
  }

  /**
   * 清理临时文件
   */
  cleanup() {
    try {
      if (fs.existsSync(this.tempPath)) {
        fs.unlinkSync(this.tempPath);
      }
    } catch (error) {
      logger.warn(`清理临时文件失败: ${this.tempPath}`);
    }
  }
}

/**
 * 下载队列管理器
 */
class DownloadQueue {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5;
    this.tasks = [];
    this.running = [];
    this.completed = [];
    this.failed = [];
    this.paused = false;
    this.onProgress = options.onProgress || null;
  }

  /**
   * 添加任务
   */
  addTask(task) {
    this.tasks.push(task);
  }

  /**
   * 批量添加任务
   */
  addTasks(tasks) {
    this.tasks.push(...tasks);
  }

  /**
   * 开始处理队列
   */
  async start() {
    this.paused = false;
    await this.processQueue();
  }

  /**
   * 暂停队列
   */
  pause() {
    this.paused = true;
  }

  /**
   * 处理队列
   */
  async processQueue() {
    while (!this.paused && (this.tasks.length > 0 || this.running.length > 0)) {
      // 填充运行槽位
      while (this.running.length < this.maxConcurrent && this.tasks.length > 0) {
        const task = this.tasks.shift();
        this.running.push(task);
        this.runTask(task).catch(error => {
          logger.error(`任务执行失败: ${error.message}`);
        });
      }

      // 等待有任务完成
      if (this.running.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * 执行单个任务
   */
  async runTask(task) {
    task.status = 'downloading';

    try {
      // 任务执行逻辑由外部提供
      if (this.taskExecutor) {
        await this.taskExecutor(task);
      }

      task.status = 'completed';
      this.completed.push(task);
    } catch (error) {
      task.error = error;
      task.status = 'failed';
      this.failed.push(task);

      // 重试逻辑
      if (task.retries < task.maxRetries) {
        task.retries++;
        task.status = 'pending';
        this.tasks.push(task); // 重新加入队列
        logger.info(`重试任务 ${task.file.path}（第${task.retries}次）`);
      }
    } finally {
      // 从运行列表中移除
      const index = this.running.indexOf(task);
      if (index >= 0) {
        this.running.splice(index, 1);
      }

      // 触发进度回调
      if (this.onProgress) {
        this.onProgress(this.getStats());
      }
    }
  }

  /**
   * 设置任务执行器
   */
  setTaskExecutor(executor) {
    this.taskExecutor = executor;
  }

  /**
   * 获取队列统计
   */
  getStats() {
    return {
      pending: this.tasks.length,
      running: this.running.length,
      completed: this.completed.length,
      failed: this.failed.length,
      total: this.tasks.length + this.running.length +
             this.completed.length + this.failed.length
    };
  }
}

/**
 * 下载管理器 - 主类
 */
class DownloadManager {
  constructor(options = {}) {
    this.httpClient = options.httpClient || getDefaultClient();
    this.queue = new DownloadQueue({
      maxConcurrent: options.maxConcurrent || 5,
      onProgress: options.onProgress
    });
    this.progress = new DownloadProgress();
    this.options = options;

    // 设置任务执行器
    this.queue.setTaskExecutor(this.executeDownload.bind(this));
  }

  /**
   * 下载文件列表
   */
  async downloadFiles(repoId, files, targetDir, options = {}) {
    // 确保目标目录存在
    this.ensureDirectory(targetDir);

    // 设置认证
    if (options.token) {
      this.httpClient.setAuthToken(options.token);
    }

    // 初始化进度
    this.progress.totalFiles = files.length;
    this.progress.totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);

    // 创建下载任务
    const tasks = files.map(file => new DownloadTask(file, targetDir, {
      ...options,
      repoId,
      revision: options.revision || 'main'
    }));

    // 过滤已完成的任务
    const pendingTasks = options.force_redownload
      ? tasks
      : tasks.filter(task => !task.isCompleted());

    if (pendingTasks.length === 0) {
      logger.info('所有文件已存在，跳过下载');
      return {
        success: true,
        message: '所有文件已是最新',
        stats: this.progress
      };
    }

    logger.info(`开始下载 ${pendingTasks.length} 个文件`);

    // 添加到队列
    this.queue.addTasks(pendingTasks);

    // 开始下载
    await this.queue.start();

    // 返回结果
    const stats = this.queue.getStats();
    return {
      success: stats.failed === 0,
      message: this.generateSummary(stats),
      stats: this.progress,
      failed: this.queue.failed.map(t => ({
        file: t.file.path,
        error: t.error?.message
      }))
    };
  }

  /**
   * 执行单个文件下载
   */
  async executeDownload(task) {
    const { file, targetPath, tempPath, options } = task;
    const { repoId, revision = 'main' } = options;

    logger.info(`开始下载: ${file.path}`);

    // 确保目标目录存在
    this.ensureDirectory(path.dirname(targetPath));

    // 构建下载URL
    const downloadUrl = this.buildDownloadUrl(repoId, file.path, revision);

    // 获取已下载大小（断点续传）
    const downloadedSize = task.getDownloadedSize();
    const headers = {};

    if (downloadedSize > 0 && downloadedSize < file.size) {
      headers.Range = `bytes=${downloadedSize}-`;
      logger.info(`断点续传: ${file.path}，从 ${this.formatBytes(downloadedSize)} 开始`);
    }

    try {
      // 创建下载流
      const response = await this.httpClient.download(downloadUrl, { headers });

      // 检查是否支持断点续传
      if (headers.Range && response.status !== 206) {
        // 服务器不支持断点续传，重新下载
        logger.warn('服务器不支持断点续传，重新下载');
        task.downloadedBytes = 0;
        fs.unlinkSync(tempPath);
      }

      // 创建写入流
      const writeStream = fs.createWriteStream(tempPath, {
        flags: downloadedSize > 0 ? 'a' : 'w'
      });

      // 进度跟踪
      let downloadedInSession = 0;
      response.data.on('data', chunk => {
        downloadedInSession += chunk.length;
        task.downloadedBytes = downloadedSize + downloadedInSession;
        this.progress.update(chunk.length);

        // 触发进度回调
        if (options.onProgress) {
          options.onProgress({
            file: file.path,
            downloaded: task.downloadedBytes,
            total: file.size,
            percentage: Math.round((task.downloadedBytes / file.size) * 100)
          });
        }
      });

      // 使用pipeline处理流
      await pipeline(response.data, writeStream);

      // 验证文件大小
      const finalStats = fs.statSync(tempPath);
      if (file.size && finalStats.size !== file.size) {
        throw new Error(`文件大小不匹配: 期望 ${file.size}, 实际 ${finalStats.size}`);
      }

      // 重命名临时文件
      fs.renameSync(tempPath, targetPath);

      this.progress.fileCompleted(file, true);
      logger.info(`下载完成: ${file.path}`);
    } catch (error) {
      this.progress.fileCompleted(file, false);
      this.progress.errors.push({
        file: file.path,
        error: error.message
      });

      // 清理失败的临时文件（如果不支持断点续传）
      if (!options.resume_on_error) {
        task.cleanup();
      }

      throw error;
    }
  }

  /**
   * 构建下载URL
   */
  buildDownloadUrl(repoId, filePath, revision) {
    const baseUrl = 'https://huggingface.co';
    return `${baseUrl}/${repoId}/resolve/${revision}/${filePath}`;
  }

  /**
   * 确保目录存在
   */
  ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.debug(`创建目录: ${dir}`);
    }
  }

  /**
   * 生成下载摘要
   */
  generateSummary(stats) {
    const parts = [];

    if (stats.completed > 0) {
      parts.push(`成功: ${stats.completed}`);
    }
    if (stats.failed > 0) {
      parts.push(`失败: ${stats.failed}`);
    }
    if (stats.running > 0) {
      parts.push(`进行中: ${stats.running}`);
    }
    if (stats.pending > 0) {
      parts.push(`等待中: ${stats.pending}`);
    }

    const speed = this.progress.formatBytes(this.progress.getSpeed());
    const time = Math.round((Date.now() - this.progress.startTime) / 1000);

    parts.push(`总耗时: ${time}秒`);
    parts.push(`平均速度: ${speed}/s`);

    return parts.join(' | ');
  }

  /**
   * 格式化字节（辅助方法）
   */
  formatBytes(bytes) {
    return this.progress.formatBytes(bytes);
  }

  /**
   * 下载单个文件（简化接口）
   */
  downloadFile(repoId, file, targetDir, options = {}) {
    return this.downloadFiles(repoId, [file], targetDir, options);
  }

  /**
   * 验证下载完整性
   */
  verifyDownload(file, targetPath) {
    try {
      if (!fs.existsSync(targetPath)) {
        return { valid: false, reason: '文件不存在' };
      }

      const stats = fs.statSync(targetPath);

      if (file.size && stats.size !== file.size) {
        return {
          valid: false,
          reason: `大小不匹配: 期望${file.size}, 实际${stats.size}`
        };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }
}

/**
 * 创建下载管理器
 */
function createDownloadManager(options) {
  return new DownloadManager(options);
}

module.exports = {
  DownloadManager,
  DownloadQueue,
  DownloadTask,
  DownloadProgress,
  createDownloadManager
};
