/**
 * MCP 服务器实现
 * 处理 JSON-RPC 协议通信和 MCP 协议逻辑
 */

const readline = require('readline');
const {
  MCP_VERSION,
  JsonRpcError,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  ServerInfo,
  ServerCapabilities,
  InitializeResult,
  parseJsonRpcMessage,
  serializeJsonRpcMessage
} = require('./types');
const { getTools } = require('./tools');
const { createLogger } = require('../utils/logger');

const logger = createLogger();

/**
 * MCP 服务器类
 */
class McpServer {
  constructor() {
    this.initialized = false;
    this.tools = getTools();
  }

  /**
   * 启动服务器，开始监听 stdin 并响应到 stdout
   */
  run() {
    // 只在非生产环境输出启动信息
    if (process.env.NODE_ENV !== 'production') {
      logger.info('启动 MCP HuggingFetch 服务器');
    }

    // 创建 readline 接口
    // 注意：不设置 output，避免干扰 stdout 的 MCP 通信
    const rl = readline.createInterface({
      input: process.stdin,
      crlfDelay: Infinity
    });

    // 处理每一行输入
    rl.on('line', async(line) => {
      if (line.trim() === '') {
        return;
      }

      logger.debug(`收到请求: ${line}`);

      try {
        const response = await this.handleMessage(line);
        if (response) {
          // 使用 process.stdout.write 确保纯净的输出
          process.stdout.write(response + '\n');
        }
      } catch (error) {
        logger.error('处理消息失败:', error);
        const errorResponse = JsonRpcResponse.error(
          'unknown',
          JsonRpcError.internalError(error.message)
        );
        // 使用 process.stdout.write 确保纯净的输出
        process.stdout.write(serializeJsonRpcMessage(errorResponse) + '\n');
      }
    });

    // 处理错误
    rl.on('error', (error) => {
      logger.error('readline 错误:', error);
    });

    // 优雅关闭
    rl.on('close', () => {
      if (process.env.NODE_ENV !== 'production') {
        logger.info('MCP 服务器关闭');
      }
    });

    // 阻止进程退出
    return new Promise((resolve) => {
      process.on('SIGINT', () => {
        logger.info('收到 SIGINT，关闭服务器');
        rl.close();
        resolve();
      });

      process.on('SIGTERM', () => {
        logger.info('收到 SIGTERM，关闭服务器');
        rl.close();
        resolve();
      });
    });
  }

  /**
   * 处理单个消息
   * @param {string} message - 输入消息
   * @returns {Promise<string|null>} 响应消息或 null（通知无需响应）
   */
  async handleMessage(message) {
    try {
      const jsonMessage = parseJsonRpcMessage(message);

      if (jsonMessage instanceof JsonRpcRequest) {
        // 处理请求
        const response = await this.handleRequest(jsonMessage);
        return serializeJsonRpcMessage(response);
      } else if (jsonMessage instanceof JsonRpcNotification) {
        // 处理通知（无需响应）
        this.handleNotification(jsonMessage);
        return null;
      } else {
        throw JsonRpcError.invalidRequest();
      }
    } catch (error) {
      logger.error('消息处理错误:', error);

      if (error instanceof JsonRpcError) {
        const response = JsonRpcResponse.error('unknown', error);
        return serializeJsonRpcMessage(response);
      } else {
        const response = JsonRpcResponse.error(
          'unknown',
          JsonRpcError.internalError(error.message)
        );
        return serializeJsonRpcMessage(response);
      }
    }
  }

  /**
   * 处理 JSON-RPC 请求
   * @param {JsonRpcRequest} request - 请求对象
   * @returns {Promise<JsonRpcResponse>} 响应对象
   */
  async handleRequest(request) {
    logger.debug(`处理请求方法: ${request.method}`);

    try {
      switch (request.method) {
      case 'initialize':
        return this.handleInitialize(request);
      case 'tools/list':
        return this.handleListTools(request);
      case 'tools/call':
        return await this.handleCallTool(request);
      default:
        return JsonRpcResponse.error(
          request.id,
          JsonRpcError.methodNotFound()
        );
      }
    } catch (error) {
      logger.error(`请求处理失败: ${error.message}`);

      if (error instanceof JsonRpcError) {
        return JsonRpcResponse.error(request.id, error);
      } else {
        return JsonRpcResponse.error(
          request.id,
          JsonRpcError.internalError(error.message)
        );
      }
    }
  }

  /**
   * 处理通知
   * @param {JsonRpcNotification} notification - 通知对象
   */
  handleNotification(notification) {
    logger.debug(`处理通知方法: ${notification.method}`);

    switch (notification.method) {
    case 'initialized':
      logger.info('客户端初始化完成');
      this.initialized = true;
      break;
    default:
      logger.debug(`忽略未知通知: ${notification.method}`);
      break;
    }
  }

  /**
   * 处理初始化请求
   * @param {JsonRpcRequest} request - 初始化请求
   * @returns {JsonRpcResponse} 初始化响应
   */
  handleInitialize(request) {
    logger.debug('处理初始化请求');

    const capabilities = new ServerCapabilities()
      .setToolsCapability(false);

    const serverInfo = new ServerInfo(
      'mcp-huggingfetch',
      require('../../package.json').version
    );

    const result = new InitializeResult(
      MCP_VERSION,
      capabilities,
      serverInfo
    );

    return JsonRpcResponse.success(request.id, result);
  }

  /**
   * 处理工具列表请求
   * @param {JsonRpcRequest} request - 工具列表请求
   * @returns {JsonRpcResponse} 工具列表响应
   */
  handleListTools(request) {
    if (!this.initialized) {
      return JsonRpcResponse.error(
        request.id,
        JsonRpcError.internalError('服务器未初始化')
      );
    }

    logger.debug('处理工具列表请求');

    const result = this.tools.getToolsListResult();
    return JsonRpcResponse.success(request.id, result);
  }

  /**
   * 处理工具调用请求
   * @param {JsonRpcRequest} request - 工具调用请求
   * @returns {JsonRpcResponse} 工具调用响应
   */
  async handleCallTool(request) {
    if (!this.initialized) {
      return JsonRpcResponse.error(
        request.id,
        JsonRpcError.internalError('服务器未初始化')
      );
    }

    logger.debug('处理工具调用请求');

    // 解析参数
    if (!request.params) {
      return JsonRpcResponse.error(
        request.id,
        JsonRpcError.invalidParams('缺少参数')
      );
    }

    const { name, arguments: args } = request.params;

    if (!name || typeof name !== 'string') {
      return JsonRpcResponse.error(
        request.id,
        JsonRpcError.invalidParams('缺少工具名称')
      );
    }

    logger.info(`调用工具: ${name}`);

    try {
      logger.debug('开始执行工具调用...');
      const result = await this.tools.callTool(name, args);
      logger.debug('工具调用完成，结果:', JSON.stringify(result, null, 2));
      const response = JsonRpcResponse.success(request.id, result);
      logger.debug('生成响应:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      logger.error(`工具调用异常: ${error.message}`, error.stack);
      return JsonRpcResponse.error(
        request.id,
        JsonRpcError.internalError(`工具调用失败: ${error.message}`)
      );
    }
  }

  /**
   * 检查服务器是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * 获取服务器状态
   * @returns {Object} 服务器状态
   */
  getStatus() {
    return {
      initialized: this.initialized,
      version: require('../../package.json').version,
      mcpVersion: MCP_VERSION,
      toolsCount: this.tools.getTools().length
    };
  }
}

module.exports = {
  McpServer
};
