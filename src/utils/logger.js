/**
 * 日志工具模块
 * 基于 winston 的日志系统，支持不同级别和格式
 */

const winston = require('winston');

/**
 * 创建日志记录器
 * @param {Object} options - 日志配置选项
 * @returns {winston.Logger} Winston 日志记录器实例
 */
function createLogger(options = {}) {
  const {
    level = process.env.LOG_LEVEL || process.env.RUST_LOG || 'info',
    format = 'text',
    silent = false
  } = options;

  // 自定义格式化器
  const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      const formattedMessage = stack ? `${message}\n${stack}` : message;
      return `[${timestamp}] ${level.toUpperCase()}: ${formattedMessage}`;
    })
  );

  const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  return winston.createLogger({
    level,
    format: format === 'json' ? jsonFormat : customFormat,
    transports: [
      new winston.transports.Console({
        silent,
        stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly']
      })
    ],
    silent
  });
}

/**
 * 安全地记录消息，过滤敏感信息
 * @param {winston.Logger} logger - 日志记录器
 * @param {string} level - 日志级别
 * @param {string} message - 消息内容
 */
function safeLog(logger, level, message) {
  // 过滤敏感信息的正则表达式
  const sensitivePatterns = [
    /hf_[a-zA-Z0-9]{34}/g, // HuggingFace tokens
    /HUGGINGFACE_TOKEN[=:]\s*[^\s]+/gi,
    /token[=:]\s*[^\s]+/gi,
    /password[=:]\s*[^\s]+/gi,
    /api_key[=:]\s*[^\s]+/gi
  ];

  let safeMessage = message;
  sensitivePatterns.forEach(pattern => {
    safeMessage = safeMessage.replace(pattern, '[REDACTED]');
  });

  logger[level](safeMessage);
}

/**
 * 安全地记录调试信息
 */
function safeDebug(logger, message) {
  safeLog(logger, 'debug', message);
}

/**
 * 安全地记录信息
 */
function safeInfo(logger, message) {
  safeLog(logger, 'info', message);
}

/**
 * 安全地记录警告
 */
function safeWarn(logger, message) {
  safeLog(logger, 'warn', message);
}

/**
 * 安全地记录错误
 */
function safeError(logger, message) {
  safeLog(logger, 'error', message);
}

/**
 * 清理命令参数中的敏感信息
 * @param {Array} args - 命令参数数组
 * @returns {Array} 清理后的参数数组
 */
function sanitizeCommandArgs(args) {
  return args.map(arg => {
    // 如果参数包含 token，替换为 [REDACTED]
    if (typeof arg === 'string' && /token/i.test(arg)) {
      return arg.replace(/hf_[a-zA-Z0-9]{34}/g, '[REDACTED]');
    }
    return arg;
  });
}

/**
 * 清理环境变量中的敏感信息
 * @param {Object} env - 环境变量对象
 * @returns {Object} 清理后的环境变量对象
 */
function sanitizeEnvVars(env) {
  const safeEnv = {};
  Object.keys(env).forEach(key => {
    if (/token|password|key/i.test(key)) {
      safeEnv[key] = '[REDACTED]';
    } else {
      safeEnv[key] = env[key];
    }
  });
  return safeEnv;
}

module.exports = {
  createLogger,
  safeLog,
  safeDebug,
  safeInfo,
  safeWarn,
  safeError,
  sanitizeCommandArgs,
  sanitizeEnvVars
};
