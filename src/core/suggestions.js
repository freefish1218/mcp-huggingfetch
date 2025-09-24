/**
 * 智能建议生成模块 - 根据查询结果生成有用的建议
 */

const { PRESET_PATTERNS } = require('./patterns');

/**
 * 建议生成器类
 */
class SuggestionGenerator {
  constructor() {
    // 常见模型类型和对应的关键文件
    this.modelTypes = {
      transformers: {
        keywords: ['pytorch_model.bin', 'model.safetensors', 'config.json'],
        description: 'Transformers模型'
      },
      diffusers: {
        keywords: ['model_index.json', 'unet/diffusion_pytorch_model.bin'],
        description: 'Diffusion模型'
      },
      gguf: {
        keywords: ['.gguf', '.ggml'],
        description: 'GGUF/GGML量化模型'
      },
      onnx: {
        keywords: ['.onnx'],
        description: 'ONNX模型'
      },
      tensorflow: {
        keywords: ['saved_model.pb', '.h5', '.tflite'],
        description: 'TensorFlow模型'
      }
    };

    // 文件大小建议阈值
    this.sizeThresholds = {
      small: 100 * 1024 * 1024, // 100MB
      medium: 1024 * 1024 * 1024, // 1GB
      large: 5 * 1024 * 1024 * 1024, // 5GB
      huge: 20 * 1024 * 1024 * 1024 // 20GB
    };
  }

  /**
   * 生成建议
   */
  generateSuggestions(context) {
    const suggestions = [];

    // 根据不同的上下文生成建议
    if (context.error) {
      suggestions.push(...this.generateErrorSuggestions(context.error));
    }

    if (context.files && context.files.length > 0) {
      suggestions.push(...this.generateFileSuggestions(context.files, context.options));
    }

    if (context.stats) {
      suggestions.push(...this.generateStatsSuggestions(context.stats));
    }

    if (context.download) {
      suggestions.push(...this.generateDownloadSuggestions(context.download));
    }

    // 去重并排序
    return this.formatSuggestions(suggestions);
  }

  /**
   * 错误相关建议
   */
  generateErrorSuggestions(error) {
    const suggestions = [];

    if (error.code === 'NOT_FOUND') {
      suggestions.push({
        type: 'error',
        priority: 1,
        text: '检查仓库ID格式是否正确（格式：owner/repo）',
        command: null
      });
      suggestions.push({
        type: 'error',
        priority: 2,
        text: '确认仓库是否存在且为公开仓库',
        command: null
      });
    }

    if (error.code === 'RATE_LIMIT') {
      suggestions.push({
        type: 'warning',
        priority: 1,
        text: '使用认证令牌以获得更高的速率限制',
        command: 'export HF_TOKEN=your_token_here'
      });
      suggestions.push({
        type: 'info',
        priority: 2,
        text: '考虑使用缓存或减少请求频率',
        command: null
      });
    }

    if (error.code === 'NETWORK_ERROR') {
      suggestions.push({
        type: 'error',
        priority: 1,
        text: '检查网络连接和防火墙设置',
        command: null
      });
      suggestions.push({
        type: 'info',
        priority: 2,
        text: '如在中国大陆，可能需要配置代理',
        command: 'export HTTPS_PROXY=your_proxy_here'
      });
    }

    if (error.code === 'UNAUTHORIZED') {
      suggestions.push({
        type: 'error',
        priority: 1,
        text: '认证失败，请检查访问权限',
        command: null
      });
      suggestions.push({
        type: 'info',
        priority: 2,
        text: '如果是私有仓库，请提供有效的访问令牌',
        command: 'export HF_TOKEN=your_token_here'
      });
    }

    if (error.code === 'FORBIDDEN') {
      suggestions.push({
        type: 'error',
        priority: 1,
        text: '权限不足，无法访问该资源',
        command: null
      });
      suggestions.push({
        type: 'info',
        priority: 2,
        text: '确认token具有所需权限',
        command: null
      });
    }

    return suggestions;
  }

  /**
   * 文件相关建议
   */
  generateFileSuggestions(files, options = {}) {
    const suggestions = [];

    // 分析文件类型
    const fileTypes = this.analyzeFileTypes(files);
    const modelType = this.detectModelType(files);

    // 模型类型建议
    if (modelType) {
      suggestions.push({
        type: 'info',
        priority: 1,
        text: `检测到${this.modelTypes[modelType].description}`,
        details: this.getModelSpecificSuggestions(modelType, files)
      });
    }

    // 文件过滤建议
    if (!options.pattern && !options.allow_patterns && files.length > 100) {
      suggestions.push({
        type: 'tip',
        priority: 2,
        text: '文件数量较多，建议使用pattern参数过滤',
        command: '使用 pattern: "*.safetensors" 只下载模型文件'
      });
    }

    // 大文件建议
    const largeFiles = files.filter(f => f.size > this.sizeThresholds.large);
    if (largeFiles.length > 0) {
      suggestions.push({
        type: 'warning',
        priority: 1,
        text: `发现 ${largeFiles.length} 个大文件（>5GB）`,
        details: '建议：使用断点续传、增加超时时间、考虑分批下载'
      });
    }

    // 文件类型分布建议
    if (fileTypes.models > 0 && fileTypes.configs > 0) {
      suggestions.push({
        type: 'info',
        priority: 3,
        text: '完整的模型仓库，包含模型文件和配置',
        details: `模型文件: ${fileTypes.models}个, 配置文件: ${fileTypes.configs}个`
      });
    }

    // 空仓库建议
    if (files.length === 0) {
      suggestions.push({
        type: 'warning',
        priority: 1,
        text: '仓库为空或没有匹配的文件',
        details: options.pattern ? '尝试调整pattern参数' : '检查仓库内容'
      });
    }

    return suggestions;
  }

  /**
   * 统计相关建议
   */
  generateStatsSuggestions(stats) {
    const suggestions = [];

    if (stats.truncated) {
      suggestions.push({
        type: 'info',
        priority: 2,
        text: `结果被截断，仅显示前 ${stats.returned_files || stats.fileCount} 个文件`,
        command: '增加 max_files 参数以获取更多文件'
      });
    }

    if (stats.total_size > this.sizeThresholds.huge) {
      const sizeGB = Math.round(stats.total_size / 1024 / 1024 / 1024);
      suggestions.push({
        type: 'warning',
        priority: 1,
        text: `仓库总大小超过 ${sizeGB}GB`,
        details: '建议：仔细选择需要下载的文件，使用pattern过滤'
      });
    }

    if (stats.directory_count > 10 && stats.depth > 3) {
      suggestions.push({
        type: 'info',
        priority: 3,
        text: '仓库结构复杂，目录层级较深',
        command: '可使用 max_depth 参数限制扫描深度'
      });
    }

    return suggestions;
  }

  /**
   * 下载相关建议
   */
  generateDownloadSuggestions(download) {
    const suggestions = [];

    // 下载速度建议
    if (download.speed && download.speed < 1024 * 100) { // 小于100KB/s
      suggestions.push({
        type: 'warning',
        priority: 2,
        text: '下载速度较慢',
        details: '建议：检查网络连接、使用更近的镜像、或在网络状况好时下载'
      });
    }

    // 断点续传建议
    if (download.resumable) {
      suggestions.push({
        type: 'info',
        priority: 3,
        text: '支持断点续传',
        details: '如果下载中断，可以继续之前的进度'
      });
    }

    // 并发下载建议
    if (download.fileCount > 10) {
      suggestions.push({
        type: 'tip',
        priority: 2,
        text: `正在下载 ${download.fileCount} 个文件`,
        details: '已启用并发下载以提高效率'
      });
    }

    // 磁盘空间建议
    if (download.requiredSpace > download.availableSpace * 0.9) {
      suggestions.push({
        type: 'error',
        priority: 1,
        text: '磁盘空间可能不足',
        details: `需要 ${this.formatSize(download.requiredSpace)}，可用 ${this.formatSize(download.availableSpace)}`
      });
    }

    return suggestions;
  }

  /**
   * 分析文件类型分布
   */
  analyzeFileTypes(files) {
    const types = {
      models: 0,
      configs: 0,
      docs: 0,
      code: 0,
      data: 0,
      other: 0
    };

    files.forEach(file => {
      const path = typeof file === 'string' ? file : file.path;
      if (this.matchesPattern(path, PRESET_PATTERNS.models)) {
        types.models++;
      } else if (this.matchesPattern(path, PRESET_PATTERNS.configs)) {
        types.configs++;
      } else if (this.matchesPattern(path, PRESET_PATTERNS.docs)) {
        types.docs++;
      } else if (this.matchesPattern(path, PRESET_PATTERNS.code)) {
        types.code++;
      } else if (this.matchesPattern(path, PRESET_PATTERNS.data)) {
        types.data++;
      } else {
        types.other++;
      }
    });

    return types;
  }

  /**
   * 检测模型类型
   */
  detectModelType(files) {
    const filePaths = files.map(f => typeof f === 'string' ? f : f.path);

    for (const [type, info] of Object.entries(this.modelTypes)) {
      const hasKeywords = info.keywords.some(keyword =>
        filePaths.some(path => path.includes(keyword))
      );
      if (hasKeywords) {
        return type;
      }
    }

    return null;
  }

  /**
   * 获取模型特定建议
   */
  getModelSpecificSuggestions(modelType, files) {
    const suggestions = [];

    switch (modelType) {
    case 'transformers':
      suggestions.push('使用 transformers 库加载: from transformers import AutoModel');
      suggestions.push('确保下载 config.json 和 tokenizer 文件');
      break;

    case 'diffusers':
      suggestions.push('使用 diffusers 库加载: from diffusers import DiffusionPipeline');
      suggestions.push('需要下载所有子目录（unet, vae, text_encoder等）');
      break;

    case 'gguf':
      suggestions.push('适用于 llama.cpp、Ollama 等工具');
      suggestions.push('选择合适的量化版本（Q4_K_M, Q5_K_M等）');
      break;

    case 'onnx':
      suggestions.push('使用 ONNX Runtime 加载');
      suggestions.push('跨平台部署的好选择');
      break;

    case 'tensorflow':
      suggestions.push('使用 TensorFlow 加载');
      suggestions.push('注意 TF1.x 和 TF2.x 的兼容性');
      break;
    }

    return suggestions.join('\n');
  }

  /**
   * 格式化建议
   */
  formatSuggestions(suggestions) {
    // 去重
    const unique = [];
    const seen = new Set();

    suggestions.forEach(suggestion => {
      const key = `${suggestion.type}-${suggestion.text}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    });

    // 按优先级排序
    unique.sort((a, b) => (a.priority || 999) - (b.priority || 999));

    // 格式化输出
    return unique.map(suggestion => this.formatSingleSuggestion(suggestion));
  }

  /**
   * 格式化单个建议
   */
  formatSingleSuggestion(suggestion) {
    const icons = {
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      tip: '💡',
      success: '✅'
    };

    let formatted = `${icons[suggestion.type] || '•'} ${suggestion.text}`;

    if (suggestion.details) {
      formatted += `\n  ${suggestion.details}`;
    }

    if (suggestion.command) {
      formatted += `\n  命令: ${suggestion.command}`;
    }

    return formatted;
  }

  /**
   * 辅助方法：匹配模式
   */
  matchesPattern(path, patterns) {
    return patterns.some(pattern => {
      if (pattern.startsWith('*')) {
        return path.endsWith(pattern.slice(1));
      }
      return path.includes(pattern);
    });
  }

  /**
   * 辅助方法：格式化文件大小
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  /**
   * 生成命令行建议
   */
  generateCommandSuggestions(context) {
    const commands = [];

    if (context.needsAuth) {
      commands.push({
        description: '设置HuggingFace令牌',
        command: 'export HF_TOKEN=your_token_here'
      });
    }

    if (context.pattern) {
      commands.push({
        description: '只下载模型文件',
        command: '--pattern "*.safetensors"'
      });
      commands.push({
        description: '排除大文件',
        command: '--ignore-patterns "*.bin"'
      });
    }

    if (context.largeRepo) {
      commands.push({
        description: '限制下载文件数量',
        command: '--max-files 10'
      });
      commands.push({
        description: '限制扫描深度',
        command: '--max-depth 2'
      });
    }

    return commands;
  }
}

/**
 * 创建建议生成器实例
 */
function createSuggestionGenerator() {
  return new SuggestionGenerator();
}

/**
 * 快速生成建议
 */
function quickSuggestions(context) {
  const generator = new SuggestionGenerator();
  return generator.generateSuggestions(context);
}

module.exports = {
  SuggestionGenerator,
  createSuggestionGenerator,
  quickSuggestions
};
