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
      this.getDownloadTool()
    ];
  }

  /**
   * 获取下载模型工具定义
   * @returns {Tool} 下载工具定义
   */
  getDownloadTool() {
    return new Tool(
      'download_huggingface_model',
      '下载任意 HuggingFace 模型到指定目录。支持指定文件、分支、包含/排除模式等选项。',
      {
        type: 'object',
        properties: {
          repo_id: {
            type: 'string',
            description: 'HuggingFace 仓库 ID，格式：用户名/模型名',
            examples: ['2Noise/ChatTTS', 'microsoft/DialoGPT-medium', 'openai/whisper-large-v3']
          },
          download_dir: {
            type: 'string',
            description: '下载目录路径（支持相对路径和绝对路径），默认为系统下载目录下的 huggingface_models 文件夹'
          },
          files: {
            type: 'array',
            description: '指定要下载的文件列表',
            items: { type: 'string' }
          },
          revision: {
            type: 'string',
            description: 'Git 分支或标签，默认为 main',
            default: 'main'
          },
          include_pattern: {
            type: 'string',
            description: '包含文件的模式匹配（glob 模式）'
          },
          exclude_pattern: {
            type: 'string',
            description: '排除文件的模式匹配（glob 模式）'
          },
          force_redownload: {
            type: 'boolean',
            description: '是否强制重新下载',
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
      // 验证输入参数
      logger.info('验证输入参数...');
      const { error, value } = validateDownloadOptions(args);

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
