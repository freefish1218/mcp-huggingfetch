/**
 * HTTP客户端模块 - 处理所有HTTP请求、重试、超时等
 */

const axios = require('axios');
const https = require('https');
const { mapHttpError, isRetryableError } = require('./errors');
const { getLogger } = require('../utils/logger');

const logger = getLogger('HttpClient');

/**
 * HTTP客户端配置
 */
const DEFAULT_CONFIG = {
  timeout: 30000, // 默认30秒超时
  maxRetries: 5, // 最大重试次数
  baseDelay: 1000, // 基础延迟（毫秒）
  maxDelay: 30000, // 最大延迟（毫秒）
  jitter: true, // 是否添加抖动
  userAgent: null, // User-Agent
  concurrency: 5, // 并发数
  keepAlive: true, // 保持连接
  maxSockets: 10 // 最大socket数
};

/**
 * HTTP客户端类
 */
class HttpClient {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };

    // 设置User-Agent
    const version = this.config.version || '1.3.0';
    this.userAgent = this.config.userAgent || `mcp-huggingfetch/${version}`;

    // 创建axios实例
    this.client = this.createAxiosInstance();

    // 设置拦截器
    this.setupInterceptors();

    // 请求队列（用于并发控制）
    this.queue = [];
    this.running = 0;
  }

  /**
   * 创建axios实例
   */
  createAxiosInstance() {
    // 创建支持连接复用的agent
    const httpsAgent = new https.Agent({
      keepAlive: this.config.keepAlive,
      maxSockets: this.config.maxSockets,
      rejectUnauthorized: true
    });

    return axios.create({
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.userAgent
      },
      httpsAgent,
      // 不自动处理错误状态码
      validateStatus: () => true,
      // 大文件支持
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
  }

  /**
   * 设置请求/响应拦截器
   */
  setupInterceptors() {
    // 请求拦截器
    this.client.interceptors.request.use(request => {
      // 添加请求ID用于追踪
      request.headers['X-Request-ID'] = this.generateRequestId();

      // 记录开始时间
      request.metadata = { startTime: Date.now() };

      logger.debug(`[${request.headers['X-Request-ID']}] ${request.method?.toUpperCase()} ${request.url}`);

      return request;
    });

    // 响应拦截器
    this.client.interceptors.response.use(
      response => {
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        logger.debug(`[${response.config.headers['X-Request-ID']}] ${response.status} ${duration}ms`);

        // 处理错误状态码
        if (response.status >= 400) {
          const error = new Error(`HTTP ${response.status}`);
          error.response = response;
          throw error;
        }

        return response;
      },
      error => {
        if (error.config?.metadata?.startTime) {
          const duration = Date.now() - error.config.metadata.startTime;
          logger.error(`[${error.config.headers?.['X-Request-ID']}] ${error.code || 'ERROR'} ${duration}ms`);
        }
        throw error;
      }
    );
  }

  /**
   * 生成请求ID
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 执行带重试的请求
   */
  request(options) {
    return this.executeWithRetry(() => this.client.request(options), options);
  }

  /**
   * GET请求
   */
  get(url, options = {}) {
    return this.request({ ...options, method: 'GET', url });
  }

  /**
   * HEAD请求
   */
  head(url, options = {}) {
    return this.request({ ...options, method: 'HEAD', url });
  }

  /**
   * 流式下载
   */
  download(url, options = {}) {
    return this.request({
      ...options,
      method: 'GET',
      url,
      responseType: 'stream'
    });
  }

  /**
   * 执行带重试的操作
   */
  async executeWithRetry(fn, options = {}) {
    const maxRetries = options.maxRetries ?? this.config.maxRetries;
    const baseDelay = options.baseDelay ?? this.config.baseDelay;
    const maxDelay = options.maxDelay ?? this.config.maxDelay;
    const jitter = options.jitter ?? this.config.jitter;

    let lastError;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // 转换为仓库错误
        const repoError = mapHttpError(error);

        // 判断是否可重试
        if (!isRetryableError(repoError)) {
          throw repoError;
        }

        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries - 1) {
          throw repoError;
        }

        // 计算延迟（指数退避）
        let delay = Math.min(
          baseDelay * Math.pow(2, attempt),
          maxDelay
        );

        // 添加抖动
        if (jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }

        // 特殊处理429响应的retry-after
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            delay = parseInt(retryAfter) * 1000;
            logger.info(`速率限制，等待 ${retryAfter} 秒后重试...`);
          }
        }

        logger.debug(`重试 ${attempt + 1}/${maxRetries}，延迟 ${Math.round(delay)}ms`);

        // 等待后重试
        await this.sleep(delay);
        attempt++;
      }
    }

    throw lastError;
  }

  /**
   * 并发控制执行
   */
  async executeWithConcurrency(task) {
    // 如果达到并发限制，等待
    while (this.running >= this.config.concurrency) {
      await new Promise(resolve => {
        this.queue.push(resolve);
      });
    }

    this.running++;

    try {
      return await task();
    } finally {
      this.running--;

      // 处理队列中的下一个任务
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * 批量并发请求
   */
  async batchRequest(requests, options = {}) {
    const concurrency = options.concurrency || this.config.concurrency;
    const results = [];
    const errors = [];

    // 创建任务
    const tasks = requests.map((req, index) => async() => {
      try {
        const result = await this.request(req);
        results[index] = { success: true, data: result };
      } catch (error) {
        results[index] = { success: false, error };
        errors.push({ index, error });
      }
    });

    // 并发执行
    const executing = [];
    for (const task of tasks) {
      const promise = this.executeWithConcurrency(task);
      executing.push(promise);

      // 控制并发数
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }

    // 等待所有任务完成
    await Promise.all(executing);

    return {
      results,
      errors,
      success: errors.length === 0
    };
  }

  /**
   * 睡眠函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 设置认证令牌
   */
  setAuthToken(token) {
    if (token) {
      this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common.Authorization;
    }
  }

  /**
   * 获取文件大小（通过HEAD请求）
   */
  async getFileSize(url) {
    try {
      const response = await this.head(url);
      const contentLength = response.headers['content-length'];
      return contentLength ? parseInt(contentLength) : null;
    } catch (error) {
      logger.warn(`无法获取文件大小: ${error.message}`);
      return null;
    }
  }

  /**
   * 检查URL是否可访问
   */
  async checkUrl(url) {
    try {
      const response = await this.head(url);
      return {
        accessible: response.status === 200,
        status: response.status,
        headers: response.headers
      };
    } catch (error) {
      return {
        accessible: false,
        error: error.message
      };
    }
  }

  /**
   * 获取重定向后的最终URL
   */
  async getFinalUrl(url) {
    try {
      const response = await this.client.get(url, {
        maxRedirects: 5,
        validateStatus: () => true
      });

      return response.request?.res?.responseUrl || response.config.url || url;
    } catch (error) {
      return url;
    }
  }

  /**
   * 创建下载流
   */
  async createDownloadStream(url, options = {}) {
    const response = await this.download(url, {
      ...options,
      headers: {
        ...options.headers,
        // 支持断点续传
        ...(options.range && { Range: `bytes=${options.range}` })
      }
    });

    return {
      stream: response.data,
      headers: response.headers,
      contentLength: parseInt(response.headers['content-length'] || '0'),
      contentType: response.headers['content-type'],
      acceptRanges: response.headers['accept-ranges'] === 'bytes'
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(url = 'https://huggingface.co/api/models') {
    try {
      const start = Date.now();
      const response = await this.head(url);
      const latency = Date.now() - start;

      return {
        healthy: response.status === 200,
        latency,
        status: response.status
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

/**
 * 创建默认HTTP客户端实例
 */
function createHttpClient(options = {}) {
  return new HttpClient(options);
}

/**
 * 单例HTTP客户端
 */
let defaultClient = null;

function getDefaultClient() {
  if (!defaultClient) {
    defaultClient = createHttpClient();
  }
  return defaultClient;
}

module.exports = {
  HttpClient,
  createHttpClient,
  getDefaultClient,
  DEFAULT_CONFIG
};
