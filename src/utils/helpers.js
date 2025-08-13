/**
 * 通用工具函数模块
 * 提供各种实用的辅助函数
 */

const fs = require('fs-extra');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger();

/**
 * 将仓库 ID 转换为有效的文件夹名称
 * @param {string} repoId - HuggingFace 仓库 ID
 * @returns {string} 文件夹名称
 */
function repoIdToFolderName(repoId) {
  return repoId.replace('/', '--');
}

/**
 * 从仓库 ID 提取模型名称
 * @param {string} repoId - HuggingFace 仓库 ID
 * @returns {string} 模型名称
 */
function extractModelName(repoId) {
  return repoId.split('/').pop() || repoId;
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串
 */
function formatSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  if (unitIndex === 0) {
    return `${bytes} ${units[unitIndex]}`;
  } else {
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

/**
 * 格式化持续时间
 * @param {number} milliseconds - 毫秒数
 * @returns {string} 格式化后的时间字符串
 */
function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

/**
 * 递归计算目录大小
 * @param {string} dirPath - 目录路径
 * @returns {Promise<number>} 目录大小（字节）
 */
async function calculateDirectorySize(dirPath) {
  let totalSize = 0;

  try {
    const stats = await fs.stat(dirPath);

    if (stats.isFile()) {
      return stats.size;
    }

    if (stats.isDirectory()) {
      const entries = await fs.readdir(dirPath);

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        totalSize += await calculateDirectorySize(entryPath);
      }
    }
  } catch (error) {
    logger.warn(`计算目录大小时出错: ${error.message}`);
  }

  return totalSize;
}

/**
 * 递归获取目录中的所有文件
 * @param {string} dirPath - 目录路径
 * @param {string} basePath - 基础路径（用于计算相对路径）
 * @returns {Promise<string[]>} 文件路径数组
 */
async function getFilesInDirectory(dirPath, basePath = dirPath) {
  const files = [];

  try {
    const stats = await fs.stat(dirPath);

    if (stats.isFile()) {
      const relativePath = path.relative(basePath, dirPath);
      return [relativePath];
    }

    if (stats.isDirectory()) {
      const entries = await fs.readdir(dirPath);

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        const entryFiles = await getFilesInDirectory(entryPath, basePath);
        files.push(...entryFiles);
      }
    }
  } catch (error) {
    logger.warn(`读取目录时出错: ${error.message}`);
  }

  return files;
}

/**
 * 确保目录存在，如果不存在则创建
 * @param {string} dirPath - 目录路径
 * @returns {Promise<void>}
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.ensureDir(dirPath);
  } catch (error) {
    throw new Error(`创建目录失败 ${dirPath}: ${error.message}`);
  }
}

/**
 * 安全地删除文件或目录
 * @param {string} targetPath - 要删除的路径
 * @returns {Promise<boolean>} 是否成功删除
 */
async function safeRemove(targetPath) {
  try {
    await fs.remove(targetPath);
    return true;
  } catch (error) {
    logger.warn(`删除文件/目录失败 ${targetPath}: ${error.message}`);
    return false;
  }
}

/**
 * 检查路径是否存在且可访问
 * @param {string} targetPath - 要检查的路径
 * @returns {Promise<boolean>} 是否存在且可访问
 */
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 创建进度显示器
 * @param {string} title - 进度标题
 * @param {number} total - 总进度
 * @returns {Object} 进度显示器对象
 */
function createProgressTracker(title, total = 100) {
  let current = 0;
  const events = [];

  return {
    /**
     * 更新进度
     * @param {number} value - 当前进度值
     * @param {string} message - 进度消息
     */
    update(value, message = '') {
      current = Math.min(value, total);
      const percentage = Math.round((current / total) * 100);
      const event = message || `${title}: ${percentage}%`;
      events.push(event);
      logger.debug(event);
    },

    /**
     * 完成进度
     * @param {string} message - 完成消息
     */
    complete(message = '完成') {
      current = total;
      events.push(`${title}: ${message}`);
      logger.info(`${title}: ${message}`);
    },

    /**
     * 获取所有进度事件
     * @returns {string[]} 进度事件数组
     */
    getEvents() {
      return [...events];
    },

    /**
     * 获取当前进度
     * @returns {number} 当前进度值
     */
    getCurrentProgress() {
      return current;
    },

    /**
     * 获取进度百分比
     * @returns {number} 百分比
     */
    getPercentage() {
      return Math.round((current / total) * 100);
    }
  };
}

/**
 * 延迟执行
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试函数
 * @param {Function} fn - 要重试的函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} delayMs - 重试间隔（毫秒）
 * @returns {Promise<any>} 函数执行结果
 */
async function retry(fn, maxRetries = 3, delayMs = 1000) {
  let lastError;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (i < maxRetries) {
        logger.warn(`重试 ${i + 1}/${maxRetries}: ${error.message}`);
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * 截断字符串到指定长度
 * @param {string} str - 输入字符串
 * @param {number} maxLength - 最大长度
 * @param {string} suffix - 截断后缀
 * @returns {string} 截断后的字符串
 */
function truncateString(str, maxLength = 100, suffix = '...') {
  if (!str || str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - suffix.length) + suffix;
}

module.exports = {
  repoIdToFolderName,
  extractModelName,
  formatSize,
  formatDuration,
  calculateDirectorySize,
  getFilesInDirectory,
  ensureDirectory,
  safeRemove,
  pathExists,
  createProgressTracker,
  delay,
  retry,
  truncateString
};
