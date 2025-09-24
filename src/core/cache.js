/**
 * 智能缓存模块 - 提供内存缓存、LRU淘汰、TTL过期等功能
 */

const crypto = require('crypto');
const { getLogger } = require('../utils/logger');

const logger = getLogger('Cache');

/**
 * 缓存条目类
 */
class CacheEntry {
  constructor(data, ttl = 300000) { // 默认5分钟TTL
    this.data = data;
    this.expiry = Date.now() + ttl;
    this.lastAccessed = Date.now();
    this.hitCount = 0;
    this.size = this.calculateSize(data);
  }

  /**
   * 估算数据大小（字节）
   */
  calculateSize(data) {
    try {
      return Buffer.byteLength(JSON.stringify(data));
    } catch {
      return 0;
    }
  }

  /**
   * 是否已过期
   */
  isExpired() {
    return Date.now() > this.expiry;
  }

  /**
   * 更新访问时间
   */
  touch() {
    this.lastAccessed = Date.now();
    this.hitCount++;
  }
}

/**
 * 智能缓存类
 */
class SmartCache {
  constructor(options = {}) {
    this.options = {
      maxSize: options.maxSize || 100, // 最大缓存条目数
      maxMemory: options.maxMemory || 50 * 1024 * 1024, // 最大内存50MB
      defaultTTL: options.defaultTTL || 300000, // 默认5分钟
      cleanupInterval: options.cleanupInterval || 60000, // 清理间隔1分钟
      algorithm: options.algorithm || 'lru' // 淘汰算法：lru, lfu, fifo
    };

    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsed: 0
    };

    // ETags缓存（用于条件请求）
    this.etags = new Map();

    // 启动定期清理
    this.startCleanup();
  }

  /**
   * 生成缓存键
   */
  getCacheKey(params) {
    // 规范化参数
    const normalized = this.normalizeParams(params);
    const keyStr = JSON.stringify(normalized);

    // 使用hash避免键过长
    return crypto
      .createHash('md5')
      .update(keyStr)
      .digest('hex');
  }

  /**
   * 规范化参数（确保相同参数生成相同的键）
   */
  normalizeParams(params) {
    if (typeof params === 'string') {
      return params;
    }

    if (typeof params !== 'object' || params === null) {
      return params;
    }

    // 递归排序对象键
    const sorted = {};
    Object.keys(params)
      .sort()
      .forEach(key => {
        const value = params[key];
        if (value !== undefined && value !== null) {
          sorted[key] = typeof value === 'object' && !Array.isArray(value)
            ? this.normalizeParams(value)
            : value;
        }
      });

    return sorted;
  }

  /**
   * 获取缓存
   */
  get(key, params = null) {
    const cacheKey = params ? this.getCacheKey({ key, ...params }) : key;
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.stats.misses++;
      logger.debug(`缓存未命中: ${cacheKey}`);
      return null;
    }

    // 检查过期
    if (entry.isExpired()) {
      this.cache.delete(cacheKey);
      this.stats.memoryUsed -= entry.size;
      this.stats.misses++;
      logger.debug(`缓存已过期: ${cacheKey}`);
      return null;
    }

    // 更新访问信息
    entry.touch();
    this.stats.hits++;
    logger.debug(`缓存命中: ${cacheKey} (第${entry.hitCount}次)`);

    return entry.data;
  }

  /**
   * 设置缓存
   */
  set(key, data, ttl = null, params = null) {
    const cacheKey = params ? this.getCacheKey({ key, ...params }) : key;
    const effectiveTTL = ttl || this.options.defaultTTL;

    // 创建缓存条目
    const entry = new CacheEntry(data, effectiveTTL);

    // 检查内存限制
    if (this.stats.memoryUsed + entry.size > this.options.maxMemory) {
      this.evict(entry.size);
    }

    // 检查条目数限制
    if (this.cache.size >= this.options.maxSize) {
      this.evictOne();
    }

    // 更新已存在的条目
    const oldEntry = this.cache.get(cacheKey);
    if (oldEntry) {
      this.stats.memoryUsed -= oldEntry.size;
    }

    // 添加新条目
    this.cache.set(cacheKey, entry);
    this.stats.memoryUsed += entry.size;

    logger.debug(`缓存设置: ${cacheKey}, TTL: ${effectiveTTL}ms, 大小: ${entry.size}字节`);

    return true;
  }

  /**
   * 删除缓存
   */
  delete(key, params = null) {
    const cacheKey = params ? this.getCacheKey({ key, ...params }) : key;
    const entry = this.cache.get(cacheKey);

    if (entry) {
      this.cache.delete(cacheKey);
      this.stats.memoryUsed -= entry.size;
      logger.debug(`缓存删除: ${cacheKey}`);
      return true;
    }

    return false;
  }

  /**
   * 清空缓存
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.etags.clear();
    this.stats.memoryUsed = 0;
    logger.info(`清空缓存: 删除了 ${size} 个条目`);
  }

  /**
   * 淘汰缓存（根据配置的算法）
   */
  evict(requiredSpace = 0) {
    const algorithm = this.options.algorithm;

    switch (algorithm) {
    case 'lru':
      this.evictLRU(requiredSpace);
      break;
    case 'lfu':
      this.evictLFU(requiredSpace);
      break;
    case 'fifo':
      this.evictFIFO(requiredSpace);
      break;
    default:
      this.evictLRU(requiredSpace);
    }
  }

  /**
   * LRU淘汰（最近最少使用）
   */
  evictLRU(requiredSpace = 0) {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      this.cache.delete(key);
      freedSpace += entry.size;
      this.stats.evictions++;
      this.stats.memoryUsed -= entry.size;

      logger.debug(`LRU淘汰: ${key}`);

      if (freedSpace >= requiredSpace) {
        break;
      }
    }
  }

  /**
   * LFU淘汰（最少使用频率）
   */
  evictLFU(requiredSpace = 0) {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].hitCount - b[1].hitCount);

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      this.cache.delete(key);
      freedSpace += entry.size;
      this.stats.evictions++;
      this.stats.memoryUsed -= entry.size;

      logger.debug(`LFU淘汰: ${key} (命中${entry.hitCount}次)`);

      if (freedSpace >= requiredSpace) {
        break;
      }
    }
  }

  /**
   * FIFO淘汰（先进先出）
   */
  evictFIFO(requiredSpace = 0) {
    let freedSpace = 0;
    for (const [key, entry] of this.cache) {
      this.cache.delete(key);
      freedSpace += entry.size;
      this.stats.evictions++;
      this.stats.memoryUsed -= entry.size;

      logger.debug(`FIFO淘汰: ${key}`);

      if (freedSpace >= requiredSpace) {
        break;
      }
    }
  }

  /**
   * 淘汰一个条目
   */
  evictOne() {
    if (this.cache.size === 0) return;

    const algorithm = this.options.algorithm;
    let keyToEvict = null;

    switch (algorithm) {
    case 'lru': {
      // 找到最久未访问的
      let oldestTime = Infinity;
      for (const [key, entry] of this.cache) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          keyToEvict = key;
        }
      }
      break;
    }

    case 'lfu': {
      // 找到使用次数最少的
      let minHits = Infinity;
      for (const [key, entry] of this.cache) {
        if (entry.hitCount < minHits) {
          minHits = entry.hitCount;
          keyToEvict = key;
        }
      }
      break;
    }

    default: // fifo
      // 删除第一个
      keyToEvict = this.cache.keys().next().value;
    }

    if (keyToEvict) {
      const entry = this.cache.get(keyToEvict);
      this.cache.delete(keyToEvict);
      this.stats.memoryUsed -= entry.size;
      this.stats.evictions++;
      logger.debug(`淘汰缓存: ${keyToEvict}`);
    }
  }

  /**
   * 定期清理过期缓存
   */
  startCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);

    // Node.js进程退出时清理
    if (typeof process !== 'undefined') {
      process.on('exit', () => {
        if (this.cleanupTimer) {
          clearInterval(this.cleanupTimer);
        }
      });
    }
  }

  /**
   * 停止定期清理
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 销毁缓存实例（清理所有资源）
   */
  destroy() {
    this.stopCleanup();
    this.cache.clear();
    this.etags.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, memoryUsed: 0 };
  }

  /**
   * 清理过期条目
   */
  cleanup() {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        this.stats.memoryUsed -= entry.size;
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`清理了 ${cleaned} 个过期缓存条目`);
    }
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
      memoryUsedMB: Math.round(this.stats.memoryUsed / 1024 / 1024 * 100) / 100
    };
  }

  /**
   * ETag支持 - 获取ETag
   */
  getETag(url) {
    return this.etags.get(url);
  }

  /**
   * ETag支持 - 设置ETag
   */
  setETag(url, etag) {
    this.etags.set(url, etag);
  }

  /**
   * 条件请求支持
   */
  async fetchWithETag(url, fetchFn) {
    const etag = this.getETag(url);

    try {
      const headers = {};
      if (etag) {
        headers['If-None-Match'] = etag;
      }

      const response = await fetchFn(url, { headers });

      // 304 Not Modified
      if (response.status === 304) {
        logger.debug(`ETag命中，使用缓存: ${url}`);
        return { cached: true, data: this.get(url) };
      }

      // 更新ETag
      const newETag = response.headers?.etag;
      if (newETag) {
        this.setETag(url, newETag);
      }

      return { cached: false, data: response.data, headers: response.headers };
    } catch (error) {
      // 发生错误时尝试返回缓存
      const cached = this.get(url);
      if (cached) {
        logger.warn(`请求失败，返回缓存数据: ${url}`);
        return { cached: true, data: cached, fallback: true };
      }
      throw error;
    }
  }

  /**
   * 停止缓存服务
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

/**
 * 创建缓存实例
 */
function createCache(options) {
  return new SmartCache(options);
}

/**
 * 默认缓存实例
 */
let defaultCache = null;

function getDefaultCache() {
  if (!defaultCache) {
    defaultCache = createCache();
  }
  return defaultCache;
}

module.exports = {
  SmartCache,
  CacheEntry,
  createCache,
  getDefaultCache
};
