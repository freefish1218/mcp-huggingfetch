/**
 * 错误处理模块 - 统一的错误定义和处理
 */

// 错误码枚举
const ErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  INVALID_PARAMS: 'INVALID_PARAMS',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  PATH_TRAVERSAL: 'PATH_TRAVERSAL'
};

/**
 * 统一的仓库错误类
 */
class RepositoryError extends Error {
  constructor(code, message, details = null, suggestions = []) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.details = details;
    this.suggestions = suggestions;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      suggestions: this.suggestions
    };
  }
}

/**
 * HTTP错误映射表
 */
const HTTP_ERROR_MAP = {
  401: {
    code: ErrorCode.UNAUTHORIZED,
    message: '认证失败',
    suggestions: ['检查 token 配置', '确认 token 是否有效']
  },
  403: {
    code: ErrorCode.FORBIDDEN,
    message: '权限不足',
    suggestions: ['确认仓库访问权限', '如果是私有仓库，请提供有效的访问令牌']
  },
  404: {
    code: ErrorCode.NOT_FOUND,
    message: '仓库或资源不存在',
    suggestions: ['检查仓库 ID 拼写', '确认仓库是否存在', '格式应为: owner/repo']
  },
  429: {
    code: ErrorCode.RATE_LIMIT,
    message: '请求频率超限',
    suggestions: ['等待后重试', '使用指数退避策略', '提供认证令牌以获得更高限额']
  }
};

/**
 * 网络错误映射表
 */
const NETWORK_ERROR_MAP = {
  ECONNRESET: {
    code: ErrorCode.NETWORK_ERROR,
    message: '连接被重置',
    suggestions: ['检查网络连接', '稍后重试']
  },
  ETIMEDOUT: {
    code: ErrorCode.TIMEOUT,
    message: '请求超时',
    suggestions: ['增加超时时间', '检查网络状况', '稍后重试']
  },
  ENOTFOUND: {
    code: ErrorCode.NETWORK_ERROR,
    message: '无法解析域名',
    suggestions: ['检查网络连接', '检查DNS设置']
  },
  ECONNREFUSED: {
    code: ErrorCode.NETWORK_ERROR,
    message: '连接被拒绝',
    suggestions: ['检查服务是否可用', '检查防火墙设置']
  }
};

/**
 * 将HTTP错误转换为RepositoryError
 */
function mapHttpError(error) {
  // 处理axios错误响应
  if (error.response) {
    const status = error.response.status;
    const errorMap = HTTP_ERROR_MAP[status];

    if (errorMap) {
      const details = {
        status,
        statusText: error.response.statusText,
        data: error.response.data
      };

      // 特殊处理429错误的retry-after
      if (status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          details.retryAfter = parseInt(retryAfter);
          const suggestions = [...errorMap.suggestions];
          suggestions[0] = `请等待 ${retryAfter} 秒后重试`;
          return new RepositoryError(
            errorMap.code,
            errorMap.message,
            details,
            suggestions
          );
        }
      }

      return new RepositoryError(
        errorMap.code,
        errorMap.message,
        details,
        errorMap.suggestions
      );
    }

    // 5xx服务器错误
    if (status >= 500) {
      return new RepositoryError(
        ErrorCode.SERVER_ERROR,
        `服务器错误: ${status}`,
        { status, statusText: error.response.statusText },
        ['稍后重试', '如问题持续，请联系支持']
      );
    }
  }

  // 处理网络错误
  if (error.code && NETWORK_ERROR_MAP[error.code]) {
    const errorMap = NETWORK_ERROR_MAP[error.code];
    return new RepositoryError(
      errorMap.code,
      errorMap.message,
      { originalCode: error.code, message: error.message },
      errorMap.suggestions
    );
  }

  // 默认网络错误
  return new RepositoryError(
    ErrorCode.NETWORK_ERROR,
    error.message || '网络请求失败',
    { originalError: error.toString() },
    ['检查网络连接', '稍后重试']
  );
}

/**
 * 判断错误是否可重试
 */
function isRetryableError(error) {
  if (error instanceof RepositoryError) {
    // 以下错误码可以重试
    const retryableCodes = [
      ErrorCode.RATE_LIMIT,
      ErrorCode.SERVER_ERROR,
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT
    ];
    return retryableCodes.includes(error.code);
  }

  // 原始错误判断
  if (error.response) {
    const status = error.response.status;
    return status === 429 || status >= 500;
  }

  // 网络错误可重试
  if (error.code) {
    return ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'].includes(error.code);
  }

  return false;
}

/**
 * 验证参数错误
 */
function createValidationError(field, message, value = null) {
  return new RepositoryError(
    ErrorCode.INVALID_PARAMS,
    `参数验证失败: ${message}`,
    { field, value },
    [`请检查 ${field} 参数的值`]
  );
}

/**
 * 用户友好的错误格式化
 */
function formatUserError(error) {
  if (error instanceof RepositoryError) {
    const messages = {
      [ErrorCode.NOT_FOUND]: {
        title: '仓库未找到',
        icon: '❌'
      },
      [ErrorCode.UNAUTHORIZED]: {
        title: '认证失败',
        icon: '🔒'
      },
      [ErrorCode.FORBIDDEN]: {
        title: '权限不足',
        icon: '⛔'
      },
      [ErrorCode.RATE_LIMIT]: {
        title: '请求频率限制',
        icon: '⏳'
      },
      [ErrorCode.NETWORK_ERROR]: {
        title: '网络连接问题',
        icon: '🌐'
      },
      [ErrorCode.TIMEOUT]: {
        title: '请求超时',
        icon: '⏱️'
      },
      [ErrorCode.INVALID_PARAMS]: {
        title: '参数错误',
        icon: '⚠️'
      }
    };

    const errorInfo = messages[error.code] || {
      title: '未知错误',
      icon: '❓'
    };

    let result = `${errorInfo.icon} ${errorInfo.title}\n`;
    result += `详情: ${error.message}\n`;

    if (error.suggestions && error.suggestions.length > 0) {
      result += '\n建议:\n';
      error.suggestions.forEach(suggestion => {
        result += `  • ${suggestion}\n`;
      });
    }

    return result;
  }

  return `错误: ${error.message || error.toString()}`;
}

module.exports = {
  ErrorCode,
  RepositoryError,
  mapHttpError,
  isRetryableError,
  createValidationError,
  formatUserError,
  HTTP_ERROR_MAP,
  NETWORK_ERROR_MAP
};
