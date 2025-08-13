/**
 * 配置管理模块
 * 基于环境变量的配置系统，与 Rust 版本保持兼容
 */

const path = require('path');
const os = require('os');
const { validateConfig } = require('../utils/validation');
const { ensureDirectory } = require('../utils/helpers');
const { createLogger } = require('../utils/logger');

const logger = createLogger();

/**
 * 应用配置类
 */
class AppConfig {
  constructor() {
    this.hf_token = this.getHfTokenFromEnv();
    this.download_dir = this.getDownloadDirFromEnv();
    this.hf_home = this.getHfHomeFromEnv();
    this.download_timeout = this.getDownloadTimeoutFromEnv();
  }

  /**
   * 从环境变量获取 HuggingFace Token
   */
  getHfTokenFromEnv() {
    return process.env.HUGGINGFACE_TOKEN ||
           process.env.HF_TOKEN ||
           '';
  }

  /**
   * 从环境变量获取下载目录
   */
  getDownloadDirFromEnv() {
    return process.env.HUGGINGFETCH_DOWNLOAD_DIR ||
           this.getDefaultDownloadDir();
  }

  /**
   * 从环境变量获取 HuggingFace 缓存目录
   */
  getHfHomeFromEnv() {
    return process.env.HF_HOME ||
           path.join(os.homedir(), '.cache', 'huggingface');
  }

  /**
   * 从环境变量获取下载超时时间
   */
  getDownloadTimeoutFromEnv() {
    const timeout = process.env.HF_DOWNLOAD_TIMEOUT;
    if (timeout) {
      const parsed = parseInt(timeout, 10);
      return isNaN(parsed) ? 300 : parsed;
    }
    return 300; // 默认 5 分钟
  }

  /**
   * 获取默认下载目录
   */
  getDefaultDownloadDir() {
    // 尝试多个可能的下载目录位置
    const possibleDirs = [
      path.join(os.homedir(), 'Downloads', 'huggingface_models'),
      path.join(os.homedir(), 'huggingface_models'),
      path.join(process.cwd(), 'models'),
      path.join(os.tmpdir(), 'huggingface_models')
    ];

    // 返回第一个可以创建的目录
    for (const dir of possibleDirs) {
      try {
        // 不实际创建，只是检查路径是否合理
        if (path.isAbsolute(dir)) {
          return dir;
        }
      } catch (error) {
        continue;
      }
    }

    // 如果都不行，返回默认路径
    return possibleDirs[0];
  }

  /**
   * 验证配置有效性
   */
  async validate() {
    // 使用 Joi 验证配置结构
    const { error, value } = validateConfig({
      hf_token: this.hf_token,
      download_dir: this.download_dir,
      hf_home: this.hf_home,
      download_timeout: this.download_timeout
    });

    if (error) {
      const message = error.details.map(detail => detail.message).join('; ');
      throw new Error(message);
    }

    // 更新配置为验证后的值
    Object.assign(this, value);

    // 验证下载目录是否存在或可创建
    try {
      await ensureDirectory(this.download_dir);
      logger.debug(`下载目录验证成功: ${this.download_dir}`);
    } catch (error) {
      throw new Error(`下载目录验证失败: ${error.message}`);
    }

    // 验证缓存目录是否存在或可创建
    try {
      await ensureDirectory(this.hf_home);
      logger.debug(`缓存目录验证成功: ${this.hf_home}`);
    } catch (error) {
      throw new Error(`缓存目录验证失败: ${error.message}`);
    }

    logger.info('配置验证完成');
    return true;
  }

  /**
   * 获取配置摘要（不包含敏感信息）
   */
  getSummary() {
    return {
      download_dir: this.download_dir,
      hf_home: this.hf_home,
      download_timeout: this.download_timeout,
      has_token: !!this.hf_token
    };
  }

  /**
   * 导出为环境变量格式
   */
  toEnvVars() {
    const envVars = {
      HF_HOME: this.hf_home
    };

    // 只在有 token 时才添加
    if (this.hf_token) {
      envVars.HUGGINGFACE_TOKEN = this.hf_token;
    }

    return envVars;
  }
}

/**
 * 创建配置实例
 */
let configInstance = null;

/**
 * 获取配置实例（单例模式）
 * @returns {AppConfig} 配置实例
 */
function getConfig() {
  if (!configInstance) {
    configInstance = new AppConfig();
  }
  return configInstance;
}

/**
 * 重新加载配置（用于测试）
 * @returns {AppConfig} 新的配置实例
 */
function reloadConfig() {
  configInstance = new AppConfig();
  return configInstance;
}

/**
 * 检查环境变量配置是否完整
 * @returns {Object} 检查结果
 */
function checkEnvironment() {
  const config = getConfig();
  const issues = [];
  const warnings = [];

  // 检查必需的环境变量
  if (!config.hf_token) {
    issues.push('HUGGINGFACE_TOKEN 环境变量未设置');
  }

  // 检查可选但推荐的环境变量
  if (!process.env.HUGGINGFETCH_DOWNLOAD_DIR) {
    warnings.push(`下载目录未配置，将使用默认路径: ${config.download_dir}`);
  }

  if (!process.env.HF_HOME) {
    warnings.push(`缓存目录未配置，将使用默认路径: ${config.hf_home}`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    config: config.getSummary()
  };
}

/**
 * 打印配置信息（用于调试）
 */
function printConfig() {
  const config = getConfig();
  const envCheck = checkEnvironment();

  console.log('=== MCP HuggingFetch 配置信息 ===');
  console.log(`下载目录: ${config.download_dir}`);
  console.log(`缓存目录: ${config.hf_home}`);
  console.log(`下载超时: ${config.download_timeout}秒`);
  console.log(`Token 状态: ${config.hf_token ? '已配置' : '未配置'}`);

  if (envCheck.warnings.length > 0) {
    console.log('\n警告:');
    envCheck.warnings.forEach(warning => console.log(`- ${warning}`));
  }

  if (envCheck.issues.length > 0) {
    console.log('\n错误:');
    envCheck.issues.forEach(issue => console.log(`- ${issue}`));
  }

  console.log('================================');
}

module.exports = {
  AppConfig,
  getConfig,
  reloadConfig,
  checkEnvironment,
  printConfig
};
