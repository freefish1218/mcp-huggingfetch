/**
 * HuggingFace 模型下载器
 * 基于 HTTP API 的原生 Node.js 下载实现
 */

const axios = require('axios');
const http = require('http');
const https = require('https');
const fs = require('fs-extra');
const path = require('path');
const {
  repoIdToFolderName,
  extractModelName,
  formatSize,
  formatDuration,
  calculateDirectorySize,
  getFilesInDirectory,
  ensureDirectory,
  createProgressTracker,
  retry
} = require('../utils/helpers');
const { validateFiles, isValidGlobPattern } = require('../utils/validation');
const { createLogger, safeInfo, safeError, safeDebug } = require('../utils/logger');

const logger = createLogger();

// 配置 HTTP Keep-Alive 连接池以提升性能
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 10, // 每个主机的最大连接数
  maxFreeSockets: 10 // 保持打开的最大空闲连接数
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 10, // 每个主机的最大连接数
  maxFreeSockets: 10 // 保持打开的最大空闲连接数
});

// 创建专用的 axios 实例，避免污染全局配置
const axiosInstance = axios.create({
  httpAgent,
  httpsAgent,
  // 添加通用超时配置（后续可被覆盖）
  timeout: 60000
});

/**
 * 下载结果类
 */
class DownloadResult {
  constructor() {
    this.success = false;
    this.model_name = '';
    this.download_path = '';
    this.files_downloaded = [];
    this.download_size = '';
    this.duration = '';
    this.progress_events = [];
    this.error = null;
  }
}

/**
 * HuggingFace 下载器类
 */
class HuggingFaceDownloader {
  constructor() {
    this.baseUrl = 'https://huggingface.co';
    this.apiUrl = 'https://huggingface.co/api';
  }

  /**
   * 下载模型的主要方法
   * @param {Object} options - 下载选项
   * @param {Object} config - 应用配置
   * @returns {Promise<DownloadResult>} 下载结果
   */
  async downloadModel(options, config) {
    const startTime = Date.now();
    const result = new DownloadResult();
    result.model_name = extractModelName(options.repo_id);

    const progress = createProgressTracker('下载进度');

    try {
      safeInfo(logger, `开始下载模型: ${options.repo_id}`);
      progress.update(0, '初始化下载环境...');

      // 设置下载目录
      const downloadDir = options.download_dir || config.download_dir;
      const repoFolderName = repoIdToFolderName(options.repo_id);
      const targetDir = path.join(downloadDir, repoFolderName);

      result.download_path = targetDir;

      // 确保目标目录存在
      await ensureDirectory(targetDir);
      progress.update(10, '创建下载目录...');

      // 使用增强的 HTTP API 下载
      progress.update(20, '开始 HTTP API 下载...');
      const downloadSuccess = await this.downloadViaHttpApi(options, config, targetDir, progress);

      if (!downloadSuccess) {
        throw new Error('下载失败，未能获取任何文件');
      }

      // 验证和收集结果
      progress.update(90, '验证下载结果...');
      await this.finalizeDownload(result, targetDir, progress);

      // 计算耗时
      const duration = Date.now() - startTime;
      result.duration = formatDuration(duration);
      result.success = true;
      result.progress_events = progress.getEvents();

      progress.complete('下载完成');
      safeInfo(logger, `模型 ${options.repo_id} 下载完成，耗时: ${result.duration}`);

      return result;
    } catch (error) {
      safeError(logger, `下载失败: ${error.message}`);
      result.error = error.message;
      result.progress_events = progress.getEvents();
      result.progress_events.push(`下载失败: ${error.message}`);
      return result;
    }
  }

  /**
   * 列出仓库中的文件
   * @param {Object} options - 列表选项
   * @param {Object} config - 应用配置
   * @returns {Promise<Object>} 文件列表结果
   */
  async listFiles(options, config) {
    const result = {
      success: false,
      repo_id: options.repo_id,
      revision: options.revision || 'main',
      total_files: 0,
      total_size: 0,
      files: [],
      error: null
    };

    try {
      safeInfo(logger, `获取仓库文件列表: ${options.repo_id}`);

      // 获取仓库信息
      const repoInfo = await retry(async() => {
        return await this.getRepositoryInfo(options.repo_id, config.hf_token);
      }, 3, 2000);

      // 添加仓库基本信息
      result.repo_name = repoInfo.modelId || repoInfo.id;
      result.author = repoInfo.author || options.repo_id.split('/')[0];
      result.last_modified = repoInfo.lastModified;
      result.likes = repoInfo.likes;
      result.downloads = repoInfo.downloads;

      // 获取文件列表（包含目录信息）
      const fileData = await retry(async() => {
        return await this.getFileList(options, repoInfo, config.hf_token, true);
      }, 3, 1000);

      // 处理返回的数据（可能是数组或对象）
      let files = Array.isArray(fileData) ? fileData : (fileData.files || []);
      let directories = Array.isArray(fileData) ? [] : (fileData.directories || []);

      // 如果指定了 pattern 参数，应用过滤
      let filteredFiles = files;
      if (options.pattern) {
        const patterns = Array.isArray(options.pattern) ? options.pattern : [options.pattern];
        filteredFiles = files.filter(file => {
          return patterns.some(pattern => this.matchGlob(file.path, pattern));
        });
      }

      // 注意：path 参数的过滤已经在 getFileList 中处理了，不需要再次过滤

      // 计算统计信息
      const totalSize = filteredFiles.reduce((sum, file) => sum + (file.size || 0), 0);

      // 格式化文件信息
      const formattedFiles = filteredFiles.map(file => {
        const fileExt = path.extname(file.path).toLowerCase();
        let fileType = 'other';

        // 识别文件类型
        if (['.safetensors', '.bin', '.pt', '.pth', '.ckpt', '.h5'].includes(fileExt)) {
          fileType = 'model';
        } else if (['.json', '.txt', '.md', '.yaml', '.yml'].includes(fileExt)) {
          fileType = 'config';
        } else if (['.py', '.js', '.sh'].includes(fileExt)) {
          fileType = 'code';
        } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(fileExt)) {
          fileType = 'image';
        }

        return {
          path: file.path,
          size: formatSize(file.size || 0),
          size_bytes: file.size || 0,
          type: fileType,
          last_modified: file.lastModified || file.lastCommit?.date,
          download_url: `${this.baseUrl}/${options.repo_id}/resolve/${options.revision || 'main'}/${file.path}`
        };
      });

      // 排序处理
      if (options.sort_by) {
        switch (options.sort_by) {
        case 'size':
          formattedFiles.sort((a, b) => b.size_bytes - a.size_bytes);
          break;
        case 'name':
          formattedFiles.sort((a, b) => a.path.localeCompare(b.path));
          break;
        case 'type':
          formattedFiles.sort((a, b) => {
            if (a.type === b.type) {
              return a.path.localeCompare(b.path);
            }
            return a.type.localeCompare(b.type);
          });
          break;
        default:
          // 默认按名称排序
          formattedFiles.sort((a, b) => a.path.localeCompare(b.path));
        }
      }

      // 组装结果
      result.success = true;
      result.total_files = formattedFiles.length;
      result.total_size = formatSize(totalSize);
      result.total_size_bytes = totalSize;
      result.files = formattedFiles;

      // 如果有目录，添加目录信息
      if (directories.length > 0) {
        result.directories = directories.map(dir => ({
          path: dir.path,
          type: 'directory'
        }));
        result.total_directories = directories.length;
      }

      // 添加统计信息
      const typeStats = {};
      formattedFiles.forEach(file => {
        if (!typeStats[file.type]) {
          typeStats[file.type] = { count: 0, size_bytes: 0 };
        }
        typeStats[file.type].count++;
        typeStats[file.type].size_bytes += file.size_bytes;
      });

      // 格式化统计信息
      result.statistics = Object.entries(typeStats).map(([type, stats]) => ({
        type,
        count: stats.count,
        size: formatSize(stats.size_bytes)
      }));

      const dirInfo = result.directories ? `，${result.total_directories} 个目录` : '';
      safeInfo(logger, `文件列表获取成功: 共 ${result.total_files} 个文件${dirInfo}，总大小 ${result.total_size}`);
      return result;
    } catch (error) {
      safeError(logger, `获取文件列表失败: ${error.message}`);
      result.error = error.message;
      return result;
    }
  }

  /**
   * 使用增强的 HuggingFace HTTP API 下载
   * @param {Object} options - 下载选项
   * @param {Object} config - 应用配置
   * @param {string} targetDir - 目标目录
   * @param {Object} progress - 进度跟踪器
   * @returns {Promise<boolean>} 是否成功
   */
  async downloadViaHttpApi(options, config, targetDir, progress) {
    safeDebug(logger, '开始增强的 HTTP API 下载');

    try {
      // 获取仓库信息（带重试）
      const repoInfo = await retry(async() => {
        return await this.getRepositoryInfo(options.repo_id, config.hf_token);
      }, 3, 2000);
      progress.update(30, '获取仓库信息...');

      // 获取文件列表（带重试）
      const files = await retry(async() => {
        return await this.getFileList(options, repoInfo, config.hf_token);
      }, 3, 1000);
      progress.update(40, `发现 ${files.length} 个文件...`);

      if (files.length === 0) {
        throw new Error('没有找到匹配的文件');
      }

      // 计算总大小用于进度跟踪
      const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
      let downloadedSize = 0;
      let downloadedCount = 0;
      const totalFiles = files.length;
      const errors = [];

      safeInfo(logger, `准备下载 ${totalFiles} 个文件，总大小: ${formatSize(totalSize)}`);

      // 并发下载文件（限制并发数）
      const concurrency = 3;
      const fileChunks = this.chunkArray(files, Math.ceil(files.length / concurrency));

      for (const chunk of fileChunks) {
        const downloadPromises = chunk.map(async(file) => {
          try {
            const fileSize = await this.downloadFileWithProgress(
              options.repo_id,
              file,
              targetDir,
              config.hf_token,
              options.revision,
              (size) => {
                downloadedSize += size;
                const percentage = 40 + Math.round((downloadedSize / totalSize) * 50);
                progress.update(percentage, `已下载 ${downloadedCount}/${totalFiles} 个文件 (${formatSize(downloadedSize)}/${formatSize(totalSize)})`);
              }
            );
            downloadedCount++;
            safeDebug(logger, `文件下载完成: ${file.path} (${formatSize(fileSize)})`);
            return { file, success: true, size: fileSize };
          } catch (error) {
            const errorMsg = `下载文件 ${file.path} 失败: ${error.message}`;
            safeError(logger, errorMsg);
            errors.push({ file: file.path, error: errorMsg });
            return { file, success: false, error: errorMsg };
          }
        });

        await Promise.all(downloadPromises);
      }

      // 报告结果
      if (downloadedCount === 0) {
        throw new Error(`所有文件下载失败。错误列表:\n${errors.map(e => `- ${e.error}`).join('\n')}`);
      }

      if (errors.length > 0) {
        safeError(logger, `部分文件下载失败 (${errors.length}/${totalFiles}):\n${errors.map(e => `- ${e.error}`).join('\n')}`);
      }

      safeInfo(logger, `成功下载 ${downloadedCount}/${totalFiles} 个文件`);
      return downloadedCount > 0;
    } catch (error) {
      safeError(logger, `HTTP API 下载失败: ${error.message}`);
      throw error;
    }
  }


  /**
   * 获取仓库信息
   * @param {string} repoId - 仓库 ID
   * @param {string} token - HuggingFace Token
   * @returns {Promise<Object>} 仓库信息
   */
  async getRepositoryInfo(repoId, token) {
    const url = `${this.apiUrl}/models/${repoId}`;
    const headers = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await axiosInstance.get(url, { headers, timeout: 10000 });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`仓库 ${repoId} 不存在或无法访问`);
      } else if (error.response?.status === 401) {
        throw new Error('HuggingFace Token 无效或权限不足');
      } else {
        throw new Error(`获取仓库信息失败: ${error.message}`);
      }
    }
  }

  /**
   * 获取文件列表
   * @param {Object} options - 下载选项
   * @param {Object} repoInfo - 仓库信息
   * @param {string} token - HuggingFace Token
   * @returns {Promise<Array>} 文件列表
   */
  async getFileList(options, repoInfo, token, includeDirectories = false) {
    const revision = options.revision || 'main';
    // 如果指定了 path 参数，将其添加到 URL 路径中
    let url = `${this.apiUrl}/models/${options.repo_id}/tree/${revision}`;
    if (options.path) {
      // 确保 path 不以斜杠开头
      const pathParam = options.path.startsWith('/') ? options.path.substring(1) : options.path;
      url = `${this.apiUrl}/models/${options.repo_id}/tree/${revision}/${pathParam}`;
    }

    const headers = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await axiosInstance.get(url, { headers, timeout: 10000 });

      // HuggingFace API 返回的数据可能包含文件和目录
      let items = response.data;

      // 分离文件和目录
      let allFiles = [];
      let directories = [];

      for (const item of items) {
        if (item.type === 'file') {
          allFiles.push(item);
        } else if (item.type === 'directory') {
          directories.push(item);
          safeDebug(logger, `发现子目录: ${item.path}`);
        }
      }

      // 如果是下载模式且有目录，递归获取子目录中的文件
      safeDebug(logger, `递归条件检查: includeDirectories=${includeDirectories}, options.path=${options.path}, directories.length=${directories.length}`);
      if (!includeDirectories && !options.path && directories.length > 0) {
        safeInfo(logger, `递归获取 ${directories.length} 个子目录的文件`);

        // 递归函数，处理多层目录
        const fetchDirRecursively = async (dirPath, maxDepth = 3, currentDepth = 1) => {
          if (currentDepth > maxDepth) {
            safeDebug(logger, `达到最大递归深度，停止递归: ${dirPath}`);
            return;
          }

          try {
            const subUrl = `${this.apiUrl}/models/${options.repo_id}/tree/${revision}/${dirPath}`;
            safeDebug(logger, `获取目录 (深度${currentDepth}): ${dirPath}`);
            const subResponse = await axiosInstance.get(subUrl, { headers, timeout: 10000 });

            for (const subItem of subResponse.data) {
              if (subItem.type === 'file') {
                allFiles.push(subItem);
                safeDebug(logger, `添加文件: ${subItem.path}`);
              } else if (subItem.type === 'directory') {
                safeDebug(logger, `发现子目录 (深度${currentDepth}): ${subItem.path}`);
                // 递归处理子目录
                await fetchDirRecursively(subItem.path, maxDepth, currentDepth + 1);
              }
            }
          } catch (subError) {
            safeError(logger, `获取目录 ${dirPath} 内容失败: ${subError.message}`);
          }
        };

        // 对每个顶级目录进行递归处理
        for (const dir of directories) {
          await fetchDirRecursively(dir.path);
        }

        safeInfo(logger, `递归后共 ${allFiles.length} 个文件`);
      }

      // 如果需要包含目录信息，则返回包含目录的结果
      if (includeDirectories || options.includeDirectories) {
        return {
          files: this.filterFiles(allFiles, options, true),  // listFiles 允许空列表
          directories: directories
        };
      }

      // 应用文件过滤
      allFiles = this.filterFiles(allFiles, options, false);  // 下载时不允许空列表

      return allFiles;
    } catch (error) {
      throw new Error(`获取文件列表失败: ${error.message}`);
    }
  }

  /**
   * 增强的文件过滤功能
   * @param {Array} files - 文件列表
   * @param {Object} options - 下载选项
   * @param {boolean} allowEmpty - 是否允许返回空列表（用于 listFiles）
   * @returns {Array} 过滤后的文件列表
   */
  filterFiles(files, options, allowEmpty = false) {
    let filteredFiles = [...files];
    const originalCount = files.length;

    safeDebug(logger, `开始过滤 ${originalCount} 个文件`);

    // 如果指定了具体文件列表
    if (options.files && options.files.length > 0) {
      const { error, value } = validateFiles(options.files);
      if (error) {
        throw error;
      }
      const fileSet = new Set(value);
      filteredFiles = filteredFiles.filter(file => fileSet.has(file.path));
      safeDebug(logger, `文件名过滤后: ${filteredFiles.length} 个文件`);
    }

    // 应用包含模式（支持多个模式）
    if (options.allow_patterns) {
      const patterns = Array.isArray(options.allow_patterns)
        ? options.allow_patterns
        : [options.allow_patterns];

      for (const pattern of patterns) {
        if (!isValidGlobPattern(pattern)) {
          throw new Error(`无效的包含模式: ${pattern}`);
        }
      }

      filteredFiles = filteredFiles.filter(file => {
        return patterns.some(pattern => this.matchGlob(file.path, pattern));
      });
      safeDebug(logger, `包含模式过滤后: ${filteredFiles.length} 个文件`);
    }

    // 应用排除模式（支持多个模式）
    if (options.ignore_patterns) {
      const patterns = Array.isArray(options.ignore_patterns)
        ? options.ignore_patterns
        : [options.ignore_patterns];

      for (const pattern of patterns) {
        if (!isValidGlobPattern(pattern)) {
          throw new Error(`无效的排除模式: ${pattern}`);
        }
      }

      filteredFiles = filteredFiles.filter(file => {
        return !patterns.some(pattern => this.matchGlob(file.path, pattern));
      });
      safeDebug(logger, `排除模式过滤后: ${filteredFiles.length} 个文件`);
    }

    // 文件大小过滤
    if (options.max_file_size) {
      const maxSize = this.parseFileSize(options.max_file_size);
      filteredFiles = filteredFiles.filter(file => {
        if (!file.size) return true; // 如果没有大小信息，则保留
        return file.size <= maxSize;
      });
      safeDebug(logger, `文件大小过滤后: ${filteredFiles.length} 个文件`);
    }

    if (options.min_file_size) {
      const minSize = this.parseFileSize(options.min_file_size);
      filteredFiles = filteredFiles.filter(file => {
        if (!file.size) return true; // 如果没有大小信息，则保留
        return file.size >= minSize;
      });
      safeDebug(logger, `最小文件大小过滤后: ${filteredFiles.length} 个文件`);
    }

    // 文件类型过滤
    if (options.file_types) {
      const types = Array.isArray(options.file_types)
        ? options.file_types
        : [options.file_types];

      filteredFiles = filteredFiles.filter(file => {
        const ext = path.extname(file.path).toLowerCase();
        return types.some(type => {
          const typeExt = type.startsWith('.') ? type : `.${type}`;
          return ext === typeExt.toLowerCase();
        });
      });
      safeDebug(logger, `文件类型过滤后: ${filteredFiles.length} 个文件`);
    }

    // 排序文件（按大小降序，确保大文件优先下载）
    if (options.sort_by_size !== false) {
      filteredFiles.sort((a, b) => (b.size || 0) - (a.size || 0));
    }

    safeInfo(logger, `文件过滤完成: ${originalCount} -> ${filteredFiles.length} 个文件`);

    if (filteredFiles.length === 0 && !allowEmpty) {
      throw new Error('过滤后没有文件需要下载，请检查过滤条件');
    }

    return filteredFiles;
  }

  /**
   * 增强的 glob 模式匹配
   * @param {string} filePath - 文件路径
   * @param {string} pattern - glob 模式
   * @returns {boolean} 是否匹配
   */
  matchGlob(filePath, pattern) {
    // 处理特殊模式
    if (pattern === '*' || pattern === '**') {
      return true;
    }

    // 规范化路径分隔符
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');

    // 转换为正则表达式
    const regex = this.globToRegex(normalizedPattern);
    return regex.test(normalizedPath);
  }

  /**
   * 将 glob 模式转换为正则表达式（修复版本）
   * @param {string} glob - glob 模式
   * @returns {RegExp} 正则表达式
   */
  globToRegex(glob) {
    let pattern = glob;

    // 使用临时占位符避免转义和替换冲突
    // 1. 处理 ** (匹配任意路径，包括子目录)
    pattern = pattern.replace(/\*\*/g, '__DOUBLESTAR__');

    // 2. 处理 * (匹配任意字符但不包括路径分隔符)
    pattern = pattern.replace(/\*/g, '__STAR__');

    // 3. 处理 ? (匹配单个字符但不包括路径分隔符)
    pattern = pattern.replace(/\?/g, '__QUESTION__');

    // 4. 处理字符类 [abc] 和 [!abc]
    pattern = pattern.replace(/\[!([^\]]*)\]/g, '__NEGCLASS__$1__ENDNEGCLASS__');
    pattern = pattern.replace(/\[([^\]]*)\]/g, '__CLASS__$1__ENDCLASS__');

    // 5. 转义其他正则表达式特殊字符
    pattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

    // 6. 替换回正确的正则表达式模式
    pattern = pattern.replace(/__DOUBLESTAR__/g, '.*');
    pattern = pattern.replace(/__STAR__/g, '[^/]*');
    pattern = pattern.replace(/__QUESTION__/g, '[^/]');
    pattern = pattern.replace(/__CLASS__([^_]*)__ENDCLASS__/g, '[$1]');
    pattern = pattern.replace(/__NEGCLASS__([^_]*)__ENDNEGCLASS__/g, '[^$1]');

    return new RegExp(`^${pattern}$`, 'i');
  }

  /**
   * 解析文件大小字符串
   * @param {string} sizeStr - 大小字符串 (如 "10MB", "1.5GB", "500KB")
   * @returns {number} 字节数
   */
  parseFileSize(sizeStr) {
    if (typeof sizeStr === 'number') {
      return sizeStr;
    }

    const str = sizeStr.toString().trim().toLowerCase();
    const match = str.match(/^(\d+(?:\.\d+)?)\s*([kmgt]?b?)$/);

    if (!match) {
      throw new Error(`无效的文件大小格式: ${sizeStr}`);
    }

    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';

    const multipliers = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
      tb: 1024 * 1024 * 1024 * 1024,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
      t: 1024 * 1024 * 1024 * 1024
    };

    const multiplier = multipliers[unit];
    if (multiplier === undefined) {
      throw new Error(`不支持的文件大小单位: ${match[2]}`);
    }

    return Math.floor(value * multiplier);
  }

  /**
   * 将数组分块
   * @param {Array} array - 要分块的数组
   * @param {number} chunkSize - 块大小
   * @returns {Array[]} 分块后的数组
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 计算基于文件大小的超时时间
   * @param {number} fileSize - 文件大小（字节）
   * @returns {Object} 超时配置 { requestTimeout, downloadTimeout }
   */
  calculateTimeouts(fileSize) {
    // 基础超时时间（毫秒）
    const BASE_REQUEST_TIMEOUT = 30000; // 30秒基础请求超时
    const BASE_DOWNLOAD_TIMEOUT = 120000; // 2分钟基础下载超时

    // 假设最低下载速度为 100KB/s
    const MIN_DOWNLOAD_SPEED = 100 * 1024; // 100KB/s

    if (!fileSize || fileSize <= 0) {
      // 文件大小未知时使用默认值
      return {
        requestTimeout: BASE_REQUEST_TIMEOUT,
        downloadTimeout: BASE_DOWNLOAD_TIMEOUT * 2.5 // 5分钟
      };
    }

    // 根据文件大小计算超时时间
    // 请求超时：基础时间 + 每100MB额外10秒
    const requestTimeout = BASE_REQUEST_TIMEOUT + Math.ceil(fileSize / (100 * 1024 * 1024)) * 10000;

    // 下载超时：基于最低速度计算，再加50%缓冲
    const estimatedTime = (fileSize / MIN_DOWNLOAD_SPEED) * 1000; // 转换为毫秒
    const downloadTimeout = Math.max(BASE_DOWNLOAD_TIMEOUT, estimatedTime * 1.5);

    // 设置最大超时限制
    const MAX_REQUEST_TIMEOUT = 180000; // 最大3分钟请求超时
    const MAX_DOWNLOAD_TIMEOUT = 3600000; // 最大1小时下载超时

    return {
      requestTimeout: Math.min(requestTimeout, MAX_REQUEST_TIMEOUT),
      downloadTimeout: Math.min(downloadTimeout, MAX_DOWNLOAD_TIMEOUT)
    };
  }

  /**
   * 下载单个文件（带进度回调和增强错误处理）
   * @param {string} repoId - 仓库 ID
   * @param {Object} file - 文件信息
   * @param {string} targetDir - 目标目录
   * @param {string} token - HuggingFace Token
   * @param {string} revision - Git 分支或标签
   * @param {Function} onProgress - 进度回调函数
   * @returns {Promise<number>} 下载的文件大小
   */
  async downloadFileWithProgress(repoId, file, targetDir, token, revision = 'main', onProgress = null) {
    const url = `${this.baseUrl}/${repoId}/resolve/${revision}/${file.path}`;
    const filePath = path.join(targetDir, file.path);

    // 确保文件目录存在
    await ensureDirectory(path.dirname(filePath));

    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // 检查文件是否已存在且大小匹配（简单的断点续传检查）
    let existingSize = 0;
    try {
      const stats = await fs.stat(filePath);
      existingSize = stats.size;
      if (file.size && existingSize === file.size) {
        safeDebug(logger, `文件已存在且大小匹配，跳过下载: ${file.path}`);
        if (onProgress) onProgress(existingSize);
        return existingSize;
      }
    } catch (error) {
      // 文件不存在，正常下载
    }

    // 支持断点续传
    if (existingSize > 0 && file.size && existingSize < file.size) {
      headers.Range = `bytes=${existingSize}-`;
      safeDebug(logger, `断点续传下载: ${file.path} (从 ${existingSize} 字节开始)`);
    }

    // 根据文件大小计算超时时间
    const timeouts = this.calculateTimeouts(file.size);
    safeDebug(logger, `文件 ${file.path} (${formatSize(file.size)}) 超时配置: 请求=${timeouts.requestTimeout / 1000}s, 下载=${timeouts.downloadTimeout / 1000}s`);

    // 使用增强的重试机制下载
    const fileSize = await retry(async() => {
      try {
        const response = await axiosInstance({
          method: 'GET',
          url,
          headers,
          responseType: 'stream',
          timeout: timeouts.requestTimeout, // 使用动态计算的请求超时
          validateStatus: (status) => {
            // 接受 200 (完整下载) 和 206 (部分内容/断点续传)
            return status === 200 || status === 206;
          }
        });

        const writeStream = existingSize > 0 && response.status === 206
          ? fs.createWriteStream(filePath, { flags: 'a' }) // 追加模式用于断点续传
          : fs.createWriteStream(filePath); // 重新写入

        let downloadedBytes = existingSize;

        // 监听下载进度
        response.data.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (onProgress) {
            onProgress(chunk.length);
          }
        });

        response.data.pipe(writeStream);

        return new Promise((resolve, reject) => {
          // 设置超时定时器（使用动态计算的下载超时）
          let timeout = setTimeout(() => {
            cleanup();
            writeStream.destroy();
            reject(new Error('下载超时'));
          }, timeouts.downloadTimeout); // 使用动态计算的下载超时

          // 清理函数，确保在所有情况下都清理定时器
          const cleanup = () => {
            if (timeout) {
              clearTimeout(timeout);
              timeout = null;
            }
          };

          writeStream.on('finish', () => {
            cleanup();
            resolve(downloadedBytes);
          });

          writeStream.on('error', (error) => {
            cleanup();
            // 清理部分下载的文件，并记录错误
            fs.unlink(filePath).catch(err => {
              logger.warn(`清理失败文件时出错: ${err.message}`);
            });
            reject(new Error(`文件写入失败: ${error.message}`));
          });

          response.data.on('error', (error) => {
            cleanup();
            writeStream.destroy();
            reject(new Error(`网络传输失败: ${error.message}`));
          });
        });
      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error(`文件不存在: ${file.path}`);
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error(`权限不足，无法下载文件: ${file.path}`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          throw new Error(`网络连接问题: ${error.message}`);
        } else {
          throw new Error(`下载失败: ${error.message}`);
        }
      }
    }, 5, 3000); // 增加重试次数和间隔

    safeDebug(logger, `下载完成: ${file.path} (${formatSize(fileSize)})`);
    return fileSize;
  }

  /**
   * 下载单个文件（兼容旧接口）
   * @param {string} repoId - 仓库 ID
   * @param {Object} file - 文件信息
   * @param {string} targetDir - 目标目录
   * @param {string} token - HuggingFace Token
   * @param {string} revision - Git 分支或标签
   * @returns {Promise<void>}
   */
  async downloadFile(repoId, file, targetDir, token, revision = 'main') {
    await this.downloadFileWithProgress(repoId, file, targetDir, token, revision);
  }

  /**
   * 完成下载后的处理
   * @param {DownloadResult} result - 下载结果
   * @param {string} targetDir - 目标目录
   * @param {Object} progress - 进度跟踪器
   */
  async finalizeDownload(result, targetDir, progress) {
    try {
      // 获取下载的文件列表
      result.files_downloaded = await getFilesInDirectory(targetDir);

      // 计算下载大小
      const totalSize = await calculateDirectorySize(targetDir);
      result.download_size = formatSize(totalSize);

      progress.update(100, '验证完成');
    } catch (error) {
      safeError(logger, `完成下载处理时出错: ${error.message}`);
      // 不抛出错误，因为下载可能已经成功
    }
  }
}

module.exports = {
  HuggingFaceDownloader,
  DownloadResult
};
