/**
 * MCP 工具定义模块 - 精简版
 * 不考虑向后兼容的简化实现
 */

const { Tool, ToolContent, CallToolResult, ListToolsResult } = require('./types');
const { createDownloader } = require('../core/downloader');
const { getConfig } = require('../core/config');
const { getLogger } = require('../utils/logger');

const logger = getLogger('MCP-Tools');

/**
 * HuggingFetch MCP 工具集合 - 精简版
 */
class HuggingFetchTools {
  constructor() {
    this.downloader = createDownloader();
  }

  /**
   * 获取所有可用工具
   */
  getTools() {
    return [
      this.getDownloadTool(),
      this.getListTool(),
      this.getExploreTool(),
      this.getSearchTool()
    ];
  }

  /**
   * 列表文件工具定义 - 标准文件列表
   */
  getListTool() {
    return new Tool(
      'list_huggingface_files',
      '列出 HuggingFace 仓库中的文件，支持过滤和排序',
      {
        type: 'object',
        properties: {
          repo_id: {
            type: 'string',
            description: 'HuggingFace 仓库 ID（格式：owner/repo）',
            examples: ['2Noise/ChatTTS', 'microsoft/DialoGPT-medium']
          },
          revision: {
            type: 'string',
            description: 'Git 分支或标签',
            default: 'main'
          },
          pattern: {
            type: 'string',
            description: 'Glob 模式过滤（例：*.safetensors）'
          },
          exclude: {
            type: 'string',
            description: '排除模式（例：*.bin）'
          },
          max_files: {
            type: 'integer',
            description: '最大文件数',
            default: 100
          },
          max_depth: {
            type: 'integer',
            description: '最大递归深度',
            default: 3
          },
          sort: {
            type: 'string',
            enum: ['name', 'size', 'type'],
            description: '排序方式',
            default: 'name'
          }
        },
        required: ['repo_id']
      }
    );
  }

  /**
   * 探索仓库工具定义 - 获取目录结构
   */
  getExploreTool() {
    return new Tool(
      'explore_huggingface_repo',
      '探索 HuggingFace 仓库的目录结构，返回层级化的文件树',
      {
        type: 'object',
        properties: {
          repo_id: {
            type: 'string',
            description: 'HuggingFace 仓库 ID（格式：owner/repo）',
            examples: ['2Noise/ChatTTS', 'microsoft/DialoGPT-medium']
          },
          revision: {
            type: 'string',
            description: 'Git 分支或标签',
            default: 'main'
          },
          max_depth: {
            type: 'integer',
            description: '最大扫描深度',
            default: 3
          },
          tree_view: {
            type: 'boolean',
            description: '是否生成ASCII树形视图',
            default: false
          }
        },
        required: ['repo_id']
      }
    );
  }

  /**
   * 搜索文件工具定义 - 按名称搜索文件
   */
  getSearchTool() {
    return new Tool(
      'search_huggingface_files',
      '在 HuggingFace 仓库中搜索特定文件',
      {
        type: 'object',
        properties: {
          repo_id: {
            type: 'string',
            description: 'HuggingFace 仓库 ID（格式：owner/repo）',
            examples: ['2Noise/ChatTTS', 'microsoft/DialoGPT-medium']
          },
          query: {
            type: 'string',
            description: '搜索关键词或模式'
          },
          revision: {
            type: 'string',
            description: 'Git 分支或标签',
            default: 'main'
          },
          max_results: {
            type: 'integer',
            description: '最大结果数',
            default: 50
          }
        },
        required: ['repo_id', 'query']
      }
    );
  }

  /**
   * 下载模型工具定义
   */
  getDownloadTool() {
    return new Tool(
      'download_huggingface_model',
      '⚡ 高速下载 HuggingFace 模型到本地',
      {
        type: 'object',
        properties: {
          repo_id: {
            type: 'string',
            description: 'HuggingFace 仓库 ID（格式：owner/repo）',
            examples: ['2Noise/ChatTTS', 'microsoft/DialoGPT-medium']
          },
          download_dir: {
            type: 'string',
            description: '下载目录（默认：~/Downloads/huggingface_models）'
          },
          revision: {
            type: 'string',
            description: 'Git 分支或标签',
            default: 'main'
          },
          pattern: {
            type: 'string',
            description: '下载文件模式（例：*.safetensors）'
          },
          exclude: {
            type: 'string',
            description: '排除文件模式（例：*.bin）'
          },
          files: {
            type: 'array',
            items: { type: 'string' },
            description: '指定下载的文件列表'
          },
          max_files: {
            type: 'integer',
            description: '最大下载文件数',
            default: 100
          },
          force: {
            type: 'boolean',
            description: '强制重新下载',
            default: false
          },
          max_concurrent: {
            type: 'integer',
            description: '最大并发下载数',
            default: 5
          }
        },
        required: ['repo_id']
      }
    );
  }

  /**
   * 调用下载工具
   */
  async callDownloadTool(args) {
    try {
      // 基础验证
      if (!args.repo_id) {
        return CallToolResult.error(
          ToolContent.text('缺少必需参数: repo_id')
        );
      }

      logger.info(`开始下载: ${args.repo_id}`);

      // 获取配置
      const config = getConfig();
      const downloadDir = args.download_dir || config.download_dir;

      // 构建目标目录
      const targetDir = require('path').join(
        downloadDir,
        args.repo_id.replace('/', '_')
      );

      // 构建选项
      const options = {
        revision: args.revision,
        pattern: args.pattern,
        exclude: args.exclude,
        files: args.files,
        maxFiles: args.max_files,
        force: args.force,
        maxConcurrent: args.max_concurrent,
        token: args.token || process.env.HF_TOKEN
      };

      // 执行下载
      const result = await this.downloader.download(
        args.repo_id,
        targetDir,
        options
      );

      if (result.success) {
        logger.info(`下载完成: ${result.files} 个文件`);

        const response = {
          success: true,
          repo_id: args.repo_id,
          path: result.path,
          files: result.files,
          size: result.size,
          duration: result.duration,
          suggestions: result.suggestions
        };

        return CallToolResult.success(
          ToolContent.text(JSON.stringify(response, null, 2))
        );
      } else {
        logger.error('下载失败:', result.error);
        return CallToolResult.error(
          ToolContent.text(JSON.stringify({
            success: false,
            error: result.error,
            suggestions: result.suggestions
          }, null, 2))
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
   * 调用列表工具 - 标准文件列表
   */
  async callListTool(args) {
    try {
      // 基础验证
      if (!args.repo_id) {
        return CallToolResult.error(
          ToolContent.text('缺少必需参数: repo_id')
        );
      }

      logger.info(`列出文件: ${args.repo_id}`);

      // 构建选项 - 固定mode为standard
      const options = {
        revision: args.revision,
        pattern: args.pattern,
        exclude: args.exclude,
        maxFiles: args.max_files,
        maxDepth: args.max_depth,
        sort: args.sort,
        mode: 'standard', // 固定为标准模式
        token: args.token || process.env.HF_TOKEN
      };

      // 执行列表
      const result = await this.downloader.list(args.repo_id, options);

      if (result.success) {
        logger.info(`获取到 ${result.files?.length || 0} 个文件`);
        return CallToolResult.success(
          ToolContent.text(JSON.stringify(result, null, 2))
        );
      } else {
        logger.error('列表失败:', result.error);
        return CallToolResult.error(
          ToolContent.text(JSON.stringify({
            success: false,
            error: result.error,
            suggestions: result.suggestions
          }, null, 2))
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
   * 调用探索工具 - 仓库结构探索
   */
  async callExploreTool(args) {
    try {
      // 基础验证
      if (!args.repo_id) {
        return CallToolResult.error(
          ToolContent.text('缺少必需参数: repo_id')
        );
      }

      logger.info(`探索仓库: ${args.repo_id}`);

      // 构建选项
      const options = {
        revision: args.revision,
        maxDepth: args.max_depth,
        mode: 'explore', // 探索模式
        treeView: args.tree_view,
        token: args.token || process.env.HF_TOKEN
      };

      // 执行探索
      const result = await this.downloader.list(args.repo_id, options);

      if (result.success) {
        logger.info(`探索完成: 深度${result.stats?.depth || 0}`);
        return CallToolResult.success(
          ToolContent.text(JSON.stringify(result, null, 2))
        );
      } else {
        logger.error('探索失败:', result.error);
        return CallToolResult.error(
          ToolContent.text(JSON.stringify({
            success: false,
            error: result.error,
            suggestions: result.suggestions
          }, null, 2))
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
   * 调用搜索工具 - 文件搜索
   */
  async callSearchTool(args) {
    try {
      // 基础验证
      if (!args.repo_id) {
        return CallToolResult.error(
          ToolContent.text('缺少必需参数: repo_id')
        );
      }

      if (!args.query) {
        return CallToolResult.error(
          ToolContent.text('缺少必需参数: query')
        );
      }

      logger.info(`搜索文件: ${args.repo_id} - ${args.query}`);

      // 使用search方法而不是list
      const result = await this.downloader.search(args.repo_id, args.query, {
        revision: args.revision,
        maxFiles: args.max_results,
        token: args.token || process.env.HF_TOKEN
      });

      if (result.success) {
        logger.info(`找到 ${result.files?.length || 0} 个匹配文件`);
        return CallToolResult.success(
          ToolContent.text(JSON.stringify(result, null, 2))
        );
      } else {
        logger.error('搜索失败:', result.error);
        return CallToolResult.error(
          ToolContent.text(JSON.stringify({
            success: false,
            error: result.error,
            suggestions: result.suggestions
          }, null, 2))
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
   * 统一工具调用入口
   * @param {string} name - 工具名称
   * @param {object} args - 工具参数
   * @returns {Promise<CallToolResult>} 调用结果
   */
  async callTool(name, args) {
    switch (name) {
    case 'download_huggingface_model':
      return await this.callDownloadTool(args);
    case 'list_huggingface_files':
      return await this.callListTool(args);
    case 'explore_huggingface_repo':
      return await this.callExploreTool(args);
    case 'search_huggingface_files':
      return await this.callSearchTool(args);
    default:
      return CallToolResult.error(
        ToolContent.text(`未知工具: ${name}`)
      );
    }
  }

  /**
   * 获取工具列表结果
   */
  getToolsListResult() {
    return new ListToolsResult(this.getTools());
  }
}

// 单例模式
let instance = null;

function getTools() {
  if (!instance) {
    instance = new HuggingFetchTools();
  }
  return instance;
}

function resetTools() {
  instance = new HuggingFetchTools();
  return instance;
}

module.exports = {
  HuggingFetchTools,
  getTools,
  resetTools
};
