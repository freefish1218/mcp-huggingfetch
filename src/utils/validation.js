/**
 * 输入验证模块
 * 使用 Joi 进行参数验证
 */

const Joi = require('joi');

/**
 * HuggingFace 仓库 ID 验证模式
 */
const repoIdSchema = Joi.string()
  .pattern(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/)
  .required()
  .messages({
    'string.pattern.base': 'repo_id 必须符合格式：用户名/仓库名',
    'any.required': 'repo_id 是必需参数'
  });

/**
 * 下载选项验证模式
 */
const downloadOptionsSchema = Joi.object({
  repo_id: repoIdSchema,
  download_dir: Joi.string().optional(),
  files: Joi.array().items(Joi.string()).optional(),
  revision: Joi.string().default('main').optional(),
  include_pattern: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional(),
  exclude_pattern: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional(),
  force_redownload: Joi.boolean().default(false).optional()
});

/**
 * 配置验证模式
 */
const configSchema = Joi.object({
  hf_token: Joi.string().required().messages({
    'any.required': 'HUGGINGFACE_TOKEN 环境变量未设置或为空',
    'string.empty': 'HUGGINGFACE_TOKEN 环境变量未设置或为空'
  }),
  download_dir: Joi.string().required(),
  hf_home: Joi.string().required(),
  download_timeout: Joi.number().integer().min(1).default(300)
});

/**
 * 验证下载选项
 * @param {Object} options - 下载选项
 * @returns {Object} 验证结果
 */
function validateDownloadOptions(options) {
  return downloadOptionsSchema.validate(options, {
    abortEarly: false,
    stripUnknown: true
  });
}

/**
 * 验证配置
 * @param {Object} config - 配置对象
 * @returns {Object} 验证结果
 */
function validateConfig(config) {
  return configSchema.validate(config, {
    abortEarly: false,
    stripUnknown: true
  });
}

/**
 * 验证仓库 ID
 * @param {string} repoId - 仓库 ID
 * @returns {Object} 验证结果
 */
function validateRepoId(repoId) {
  return repoIdSchema.validate(repoId);
}

/**
 * 检查文件路径是否安全（防止路径遍历攻击）
 * @param {string} filePath - 文件路径
 * @returns {boolean} 是否安全
 */
function isPathSafe(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  // 检查路径遍历模式
  const dangerousPatterns = [
    /\.\./, // 包含 ..
    /^\//, // 绝对路径
    /^~/, // 家目录路径
    /^[a-zA-Z]:\\/, // Windows 绝对路径
    /\0/, // 空字节
    /[\r\n]/ // 换行符
  ];

  return !dangerousPatterns.some(pattern => pattern.test(filePath));
}

/**
 * 标准化文件路径
 * @param {string} filePath - 文件路径
 * @returns {string} 标准化后的路径
 */
function normalizePath(filePath) {
  if (!filePath) return '';

  // 移除多余的斜杠和相对路径
  return filePath
    .replace(/\/+/g, '/') // 多个斜杠变成一个
    .replace(/\/\.\//g, '/') // 移除 /./
    .replace(/^\.\//, '') // 移除开头的 ./
    .replace(/\/$/, ''); // 移除结尾的斜杠
}

/**
 * 验证文件名数组
 * @param {Array} files - 文件名数组
 * @returns {Object} 验证结果
 */
function validateFiles(files) {
  if (!files || !Array.isArray(files)) {
    return { error: null, value: files };
  }

  const invalidFiles = files.filter(file => !isPathSafe(file));

  if (invalidFiles.length > 0) {
    return {
      error: new Error(`不安全的文件路径: ${invalidFiles.join(', ')}`),
      value: null
    };
  }

  return {
    error: null,
    value: files.map(normalizePath)
  };
}

/**
 * 验证 glob 模式
 * @param {string} pattern - glob 模式
 * @returns {boolean} 是否是有效的 glob 模式
 */
function isValidGlobPattern(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return false;
  }

  // 基本的 glob 模式验证
  try {
    // 检查是否包含危险字符
    const dangerousChars = /[\0\r\n]/;
    if (dangerousChars.test(pattern)) {
      return false;
    }

    // 基本的 glob 字符验证
    const validGlobChars = /^[a-zA-Z0-9._\-*/[\]{}?!]+$/;
    return validGlobChars.test(pattern);
  } catch (error) {
    return false;
  }
}

module.exports = {
  validateDownloadOptions,
  validateConfig,
  validateRepoId,
  validateFiles,
  isPathSafe,
  normalizePath,
  isValidGlobPattern,
  downloadOptionsSchema,
  configSchema,
  repoIdSchema
};
