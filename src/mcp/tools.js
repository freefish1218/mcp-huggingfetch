/**
 * MCP 工具定义模块
 * 定义和处理 HuggingFace 下载工具
 */

const { Tool, ToolContent, CallToolResult, ListToolsResult } = require('./types');
const { validateDownloadOptions } = require('../utils/validation');
const { HuggingFaceDownloader } = require('../core/downloader');
const { getConfig } = require('../core/config');
const { createLogger } = require('../utils/logger');

const logger = createLogger();

/**
 * HuggingFetch MCP 工具集合
 */
class HuggingFetchTools {
  constructor() {
    this.downloader = new HuggingFaceDownloader();
  }

  /**
   * 获取所有可用工具的列表
   * @returns {Tool[]} 工具数组
   */
  getTools() {
    return [
      this.getDownloadTool(),
      this.getListTool()
    ];
  }

  /**
   * 获取列表文件工具定义
   * @returns {Tool} 列表工具定义
   */
  getListTool() {
    return new Tool(
      'list_huggingface_files',
      '列出 HuggingFace 仓库中的所有文件，包括文件路径、大小、类型等详细信息',
      {
        type: 'object',
        properties: {
          repo_id: {
            type: 'string',
            description: 'HuggingFace 仓库 ID，格式：用户名/模型名',
            examples: ['2Noise/ChatTTS', 'microsoft/DialoGPT-medium', 'openai/whisper-large-v3']
          },
          revision: {
            type: 'string',
            description: 'Git 分支或标签，默认为 main',
            default: 'main'
          },
          path: {
            type: 'string',
            description: '仓库内的子路径（可选，用于浏览特定目录）'
          },
          pattern: {
            type: 'string',
            description: '文件名过滤模式（glob 模式），例如: *.safetensors, *.json'
          },
          sort_by: {
            type: 'string',
            description: '排序方式: size（按大小）, name（按名称）, type（按类型）',
            enum: ['size', 'name', 'type'],
            default: 'name'
          }
        },
        required: ['repo_id']
      }
    );
  }

  /**
   * 获取下载模型工具定义
   * @returns {Tool} 下载工具定义
   */
  getDownloadTool() {
    return new Tool(
      'download_huggingface_model',
      '⚡ 高速下载 HuggingFace 模型到本地 - 支持并发下载、断点续传、智能重试，比传统方式快3-5倍。可指定文件、分支、筛选模式等高级选项。',
      {
        type: 'object',
        properties: {
          repo_id: {
            type: 'string',
            description: 'HuggingFace 仓库 ID，格式：用户名/模型名',
            examples: ['2Noise/ChatTTS', 'microsoft/DialoGPT-medium', 'openai/whisper-large-v3', 'meta-llama/Meta-Llama-3.1-8B']
          },
          download_dir: {
            type: 'string',
            description: '下载保存目录（支持相对/绝对路径），默认：~/Downloads/huggingface_models'
          },
          files: {
            type: 'array',
            description: '指定下载的具体文件列表（精确匹配文件路径）',
            items: { type: 'string' },
            examples: [['config.json', 'model.safetensors']]
          },
          revision: {
            type: 'string',
            description: 'Git 分支、标签或 commit hash，默认：main',
            default: 'main'
          },
          allow_patterns: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } }
            ],
            description: '允许下载的文件模式（glob 语法），支持单个或多个模式',
            examples: ['*.json', ['*.safetensors', '*.bin'], '**/model-*.safetensors']
          },
          ignore_patterns: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } }
            ],
            description: '忽略的文件模式（glob 语法），支持单个或多个模式',
            examples: ['*.h5', ['*.msgpack', '*.ckpt'], 'vocab.json']
          },
          include_pattern: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } }
            ],
            description: '(兼容参数) 等同于 allow_patterns',
            deprecated: true
          },
          exclude_pattern: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } }
            ],
            description: '(兼容参数) 等同于 ignore_patterns',
            deprecated: true
          },
          force_redownload: {
            type: 'boolean',
            description: '强制重新下载（忽略本地缓存）',
            default: false
          }
        },
        required: ['repo_id']
      }
    );
  }

  /**
   * 调用指定的工具
   * @param {string} name - 工具名称
   * @param {Object} args - 工具参数
   * @returns {Promise<CallToolResult>} 调用结果
   */
  async callTool(name, args = {}) {
    logger.info(`调用工具: ${name}`);

    switch (name) {
    case 'download_huggingface_model':
      return await this.callDownloadTool(args);
    case 'list_huggingface_files':
      return await this.callListTool(args);
    default:
      return CallToolResult.error(
        ToolContent.text(`未知工具: ${name}`)
      );
    }
  }

  /**
   * 调用下载模型工具
   * @param {Object} args - 工具参数
   * @returns {Promise<CallToolResult>} 调用结果
   */
  async callDownloadTool(args) {
    try {
      // 参数兼容性处理：支持新的 allow_patterns/ignore_patterns 参数名称
      const processedArgs = { ...args };
      
      // 优先使用新参数名称，如果没有则使用旧参数名称
      if (args.allow_patterns !== undefined) {
        processedArgs.include_pattern = args.allow_patterns;
      }
      if (args.ignore_patterns !== undefined) {
        processedArgs.exclude_pattern = args.ignore_patterns;
      }
      
      // 移除新参数名称，避免传递给下游
      delete processedArgs.allow_patterns;
      delete processedArgs.ignore_patterns;
      
      // 验证输入参数
      logger.info('验证输入参数...');
      const { error, value } = validateDownloadOptions(processedArgs);

      if (error) {
        const message = error.details.map(detail => detail.message).join('; ');
        logger.error(`输入验证失败: ${message}`);
        return CallToolResult.error(
          ToolContent.text(`输入验证失败: ${message}`)
        );
      }

      // 获取配置
      const config = getConfig();

      // 验证配置
      try {
        await config.validate();
      } catch (configError) {
        logger.error(`配置验证失败: ${configError.message}`);
        return CallToolResult.error(
          ToolContent.text(`配置验证失败: ${configError.message}`)
        );
      }

      logger.info('开始执行下载工具，参数:', JSON.stringify(value, null, 2));

      // 执行下载
      const result = await this.downloader.downloadModel(value, config);

      if (result.success) {
        logger.info('下载完成:', JSON.stringify(result, null, 2));

        const response = {
          success: result.success,
          model_name: result.model_name,
          download_path: result.download_path,
          files_downloaded: result.files_downloaded,
          download_size: result.download_size,
          duration: result.duration,
          progress_events: result.progress_events
        };

        return CallToolResult.success(
          ToolContent.text(JSON.stringify(response, null, 2))
        );
      } else {
        logger.error('下载失败:', result.error);
        return CallToolResult.error(
          ToolContent.text(`下载失败: ${result.error}`)
        );
      }
    } catch (error) {
      logger.error('工具调用失败:', error);
      return CallToolResult.error(
        ToolContent.text(`工具调用失败: ${error.message}`)
      );
    }
  }

  /**
   * 调用列表文件工具
   * @param {Object} args - 工具参数
   * @returns {Promise<CallToolResult>} 调用结果
   */
  async callListTool(args) {
    try {
      // 基础参数验证
      if (!args.repo_id) {
        return CallToolResult.error(
          ToolContent.text('缺少必需参数: repo_id')
        );
      }

      logger.info('获取文件列表，参数:', JSON.stringify(args, null, 2));

      // 获取配置
      const config = getConfig();

      // 验证配置
      try {
        await config.validate();
      } catch (configError) {
        logger.error(`配置验证失败: ${configError.message}`);
        return CallToolResult.error(
          ToolContent.text(`配置验证失败: ${configError.message}`)
        );
      }

      // 调用下载器的列表方法
      const result = await this.downloader.listFiles(args, config);

      if (result.success) {
        logger.info('文件列表获取成功');
        return CallToolResult.success(
          ToolContent.text(JSON.stringify(result, null, 2))
        );
      } else {
        logger.error('获取文件列表失败:', result.error);
        return CallToolResult.error(
          ToolContent.text(`获取文件列表失败: ${result.error}`)
        );
      }
    } catch (error) {
      logger.error('列表工具调用失败:', error);
      return CallToolResult.error(
        ToolContent.text(`列表工具调用失败: ${error.message}`)
      );
    }
  }

  /**
   * 获取工具列表结果
   * @returns {ListToolsResult} 工具列表结果
   */
  getToolsListResult() {
    return new ListToolsResult(this.getTools());
  }
}

// 创建单例实例
let toolsInstance = null;

/**
 * 获取工具实例（单例模式）
 * @returns {HuggingFetchTools} 工具实例
 */
function getTools() {
  if (!toolsInstance) {
    toolsInstance = new HuggingFetchTools();
  }
  return toolsInstance;
}

/**
 * 重新创建工具实例（用于测试）
 * @returns {HuggingFetchTools} 新的工具实例
 */
function resetTools() {
  toolsInstance = new HuggingFetchTools();
  return toolsInstance;
}

module.exports = {
  HuggingFetchTools,
  getTools,
  resetTools
};
