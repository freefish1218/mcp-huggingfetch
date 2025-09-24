/**
 * 模式匹配模块 - 基于 micromatch 的统一 glob 处理
 */

const micromatch = require('micromatch');
const path = require('path');

/**
 * 匹配单个文件路径是否符合模式
 * @param {string} filePath - 文件路径
 * @param {string|string[]} pattern - glob 模式，可以是字符串或数组
 * @returns {boolean} 是否匹配
 */
function matchPattern(filePath, pattern) {
  if (!pattern) {
    return true; // 没有模式时匹配所有
  }

  // 统一处理路径分隔符
  const normalizedPath = filePath.replace(/\\/g, '/');

  // 单个模式
  if (typeof pattern === 'string') {
    // 如果模式不包含路径分隔符且不包含通配符，则匹配文件名
    if (!pattern.includes('/') && !pattern.includes('*') && !pattern.includes('?')) {
      // 精确文件名匹配 - config.json 应该匹配 path/to/config.json
      return normalizedPath.endsWith('/' + pattern) || normalizedPath === pattern;
    }
    return micromatch.isMatch(normalizedPath, pattern);
  }

  // 多个模式（数组）
  if (Array.isArray(pattern)) {
    return pattern.some(p => matchPattern(filePath, p));
  }

  return true;
}

/**
 * 应用文件过滤器
 * @param {string[]} files - 文件路径数组
 * @param {object} filter - 过滤器选项
 * @param {string|string[]} filter.include - 包含模式（之前的 allow_patterns）
 * @param {string|string[]} filter.exclude - 排除模式（之前的 ignore_patterns）
 * @returns {string[]} 过滤后的文件列表
 */
function applyFilter(files, filter = {}) {
  if (!filter || (!filter.include && !filter.exclude)) {
    return files;
  }

  let filtered = files.map(f => f.replace(/\\/g, '/')); // 标准化路径

  // 应用包含模式
  if (filter.include) {
    const patterns = Array.isArray(filter.include) ? filter.include : [filter.include];
    filtered = micromatch(filtered, patterns);
  }

  // 应用排除模式
  if (filter.exclude) {
    const patterns = Array.isArray(filter.exclude) ? filter.exclude : [filter.exclude];
    filtered = micromatch.not(filtered, patterns);
  }

  return filtered;
}

/**
 * 检查文件是否应该被忽略
 * @param {string} filePath - 文件路径
 * @param {string|string[]} ignorePatterns - 忽略模式
 * @returns {boolean} 是否应该被忽略
 */
function shouldIgnore(filePath, ignorePatterns) {
  if (!ignorePatterns) {
    return false;
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  const patterns = Array.isArray(ignorePatterns) ? ignorePatterns : [ignorePatterns];

  return micromatch.isMatch(normalizedPath, patterns);
}

/**
 * 将文件列表按模式分组
 * @param {string[]} files - 文件列表
 * @param {object} patterns - 模式映射 { key: pattern }
 * @returns {object} 分组后的文件 { key: files[] }
 */
function groupByPattern(files, patterns) {
  const groups = {};

  for (const [key, pattern] of Object.entries(patterns)) {
    groups[key] = files.filter(file => matchPattern(file, pattern));
  }

  // 添加未匹配的文件
  const allMatched = new Set();
  Object.values(groups).forEach(group => {
    group.forEach(file => allMatched.add(file));
  });

  groups.unmatched = files.filter(file => !allMatched.has(file));

  return groups;
}

/**
 * 验证 glob 模式是否有效
 * @param {string} pattern - glob 模式
 * @returns {object} { valid: boolean, error?: string }
 */
function validatePattern(pattern) {
  try {
    // 尝试使用模式进行匹配测试
    micromatch.isMatch('test', pattern);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `无效的 glob 模式: ${error.message}`
    };
  }
}

/**
 * 转换旧版模式参数到新格式
 * @param {object} options - 旧版选项
 * @returns {object} 新版过滤器格式
 */
function migratePatterns(options) {
  const filter = {};

  // 如果已经是新格式，直接使用
  if (options.include || options.exclude) {
    filter.include = options.include;
    filter.exclude = options.exclude;
    return filter;
  }

  // 处理包含模式（旧格式）
  if (options.allow_patterns) {
    filter.include = options.allow_patterns;
  } else if (options.pattern) {
    filter.include = options.pattern;
  } else if (options.files && Array.isArray(options.files)) {
    // 精确匹配文件列表
    filter.include = options.files;
  }

  // 处理排除模式（旧格式）
  if (options.ignore_patterns) {
    filter.exclude = options.ignore_patterns;
  }

  return filter;
}

/**
 * 根据文件扩展名分类
 * @param {string[]} files - 文件列表
 * @returns {object} 按扩展名分类的文件
 */
function groupByExtension(files) {
  const groups = {};

  files.forEach(file => {
    const ext = path.extname(file).toLowerCase() || 'no-extension';
    if (!groups[ext]) {
      groups[ext] = [];
    }
    groups[ext].push(file);
  });

  return groups;
}

/**
 * 常用的预定义模式
 */
const PRESET_PATTERNS = {
  // 模型文件
  models: ['*.safetensors', '*.bin', '*.pt', '*.pth', '*.onnx', '*.ckpt', '*.h5'],

  // 配置文件
  configs: ['*.json', '*.yaml', '*.yml', '*.toml', 'config.*'],

  // 文档文件
  docs: ['*.md', '*.txt', '*.rst', 'README*', 'LICENSE*'],

  // 代码文件
  code: ['*.py', '*.js', '*.ts', '*.jsx', '*.tsx', '*.java', '*.cpp', '*.c'],

  // 数据文件
  data: ['*.csv', '*.tsv', '*.jsonl', '*.parquet', '*.arrow'],

  // 媒体文件
  media: ['*.jpg', '*.jpeg', '*.png', '*.gif', '*.mp4', '*.mp3', '*.wav'],

  // 压缩文件
  archives: ['*.zip', '*.tar', '*.tar.gz', '*.tgz', '*.tar.bz2', '*.rar', '*.7z']
};

/**
 * 获取文件类型（基于预定义模式）
 * @param {string} filePath - 文件路径
 * @returns {string} 文件类型
 */
function getFileType(filePath) {
  for (const [type, patterns] of Object.entries(PRESET_PATTERNS)) {
    if (matchPattern(filePath, patterns)) {
      return type;
    }
  }
  return 'other';
}

/**
 * 创建文件过滤器
 * @param {object} options - 过滤选项
 * @returns {function} 过滤函数
 */
function createFileFilter(options = {}) {
  const filter = migratePatterns(options);

  return (files) => {
    let result = Array.isArray(files) ? files : [files];

    // 应用包含模式
    if (filter.include) {
      result = result.filter(file => matchPattern(file, filter.include));
    }

    // 应用排除模式
    if (filter.exclude) {
      result = result.filter(file => !matchPattern(file, filter.exclude));
    }

    // 应用大小过滤
    if (options.maxSize || options.minSize) {
      result = result.filter(file => {
        if (file.size === undefined) return true;
        if (options.maxSize && file.size > options.maxSize) return false;
        if (options.minSize && file.size < options.minSize) return false;
        return true;
      });
    }

    // 应用类型过滤
    if (options.types && Array.isArray(options.types)) {
      result = result.filter(file => {
        const type = getFileType(typeof file === 'string' ? file : file.path);
        return options.types.includes(type);
      });
    }

    return result;
  };
}

/**
 * 扩展 glob 模式以包含所有子目录
 * @param {string|string[]} pattern - 原始模式
 * @returns {string|string[]} 扩展后的模式
 */
function expandPattern(pattern) {
  if (typeof pattern === 'string') {
    // 如果模式不包含 **，添加它
    if (!pattern.includes('**')) {
      return `**/${pattern}`;
    }
    return pattern;
  }

  if (Array.isArray(pattern)) {
    return pattern.map(p => expandPattern(p));
  }

  return pattern;
}

module.exports = {
  matchPattern,
  applyFilter,
  shouldIgnore,
  groupByPattern,
  validatePattern,
  migratePatterns,
  groupByExtension,
  getFileType,
  createFileFilter,
  expandPattern,
  PRESET_PATTERNS
};
