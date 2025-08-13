/**
 * MCP 协议类型定义
 * 与 Rust 版本保持一致的类型系统
 */

/**
 * MCP 协议版本
 */
const MCP_VERSION = '2024-11-05';

/**
 * 标准错误代码
 */
const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603
};

/**
 * 创建标准错误对象
 */
class JsonRpcError extends Error {
  constructor(code, message, data = null) {
    super(message);
    this.name = 'JsonRpcError';
    this.code = code;
    this.data = data;
  }

  static parseError(data = null) {
    return new JsonRpcError(ErrorCodes.PARSE_ERROR, 'Parse error', data);
  }

  static invalidRequest(data = null) {
    return new JsonRpcError(ErrorCodes.INVALID_REQUEST, 'Invalid Request', data);
  }

  static methodNotFound(data = null) {
    return new JsonRpcError(ErrorCodes.METHOD_NOT_FOUND, 'Method not found', data);
  }

  static invalidParams(message = 'Invalid params', data = null) {
    return new JsonRpcError(ErrorCodes.INVALID_PARAMS, message, data);
  }

  static internalError(message = 'Internal error', data = null) {
    return new JsonRpcError(ErrorCodes.INTERNAL_ERROR, message, data);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.data && { data: this.data })
    };
  }
}

/**
 * JSON-RPC 请求类
 */
class JsonRpcRequest {
  constructor(id, method, params = null) {
    this.jsonrpc = '2.0';
    this.id = id;
    this.method = method;
    if (params !== null) {
      this.params = params;
    }
  }

  static fromJSON(json) {
    if (typeof json !== 'object' || json === null) {
      throw JsonRpcError.invalidRequest();
    }

    if (json.jsonrpc !== '2.0') {
      throw JsonRpcError.invalidRequest();
    }

    if (!json.method || typeof json.method !== 'string') {
      throw JsonRpcError.invalidRequest();
    }

    if (json.id === undefined) {
      throw JsonRpcError.invalidRequest();
    }

    return new JsonRpcRequest(json.id, json.method, json.params);
  }
}

/**
 * JSON-RPC 响应类
 */
class JsonRpcResponse {
  constructor(id, result = null, error = null) {
    this.jsonrpc = '2.0';
    this.id = id;
    if (error) {
      this.error = error;
    } else {
      this.result = result;
    }
  }

  static success(id, result) {
    return new JsonRpcResponse(id, result);
  }

  static error(id, error) {
    return new JsonRpcResponse(id, null, error);
  }
}

/**
 * JSON-RPC 通知类
 */
class JsonRpcNotification {
  constructor(method, params = null) {
    this.jsonrpc = '2.0';
    this.method = method;
    if (params !== null) {
      this.params = params;
    }
  }

  static fromJSON(json) {
    if (typeof json !== 'object' || json === null) {
      throw JsonRpcError.invalidRequest();
    }

    if (json.jsonrpc !== '2.0') {
      throw JsonRpcError.invalidRequest();
    }

    if (!json.method || typeof json.method !== 'string') {
      throw JsonRpcError.invalidRequest();
    }

    if (json.id !== undefined) {
      throw JsonRpcError.invalidRequest();
    }

    return new JsonRpcNotification(json.method, json.params);
  }
}

/**
 * MCP 服务器信息
 */
class ServerInfo {
  constructor(name, version) {
    this.name = name;
    this.version = version;
  }
}

/**
 * MCP 客户端信息
 */
class ClientInfo {
  constructor(name, version) {
    this.name = name;
    this.version = version;
  }
}

/**
 * 服务器能力
 */
class ServerCapabilities {
  constructor() {
    this.tools = null;
    this.resources = null;
    this.prompts = null;
  }

  setToolsCapability(listChanged = false) {
    this.tools = { listChanged };
    return this;
  }

  setResourcesCapability(subscribe = false, listChanged = false) {
    this.resources = { subscribe, listChanged };
    return this;
  }

  setPromptsCapability(listChanged = false) {
    this.prompts = { listChanged };
    return this;
  }
}

/**
 * 客户端能力
 */
class ClientCapabilities {
  constructor() {
    this.roots = null;
    this.sampling = null;
  }
}

/**
 * 初始化结果
 */
class InitializeResult {
  constructor(protocolVersion, capabilities, serverInfo) {
    this.protocolVersion = protocolVersion;
    this.capabilities = capabilities;
    this.serverInfo = serverInfo;
  }
}

/**
 * 工具定义
 */
class Tool {
  constructor(name, description, inputSchema) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
  }
}

/**
 * 工具内容类型
 */
class ToolContent {
  static text(text) {
    return {
      type: 'text',
      text
    };
  }

  static image(data, mimeType) {
    return {
      type: 'image',
      data,
      mimeType
    };
  }

  static resource(uri) {
    return {
      type: 'resource',
      resource: { uri }
    };
  }
}

/**
 * 工具调用结果
 */
class CallToolResult {
  constructor(content, isError = false) {
    this.content = Array.isArray(content) ? content : [content];
    if (isError) {
      this.isError = true;
    }
  }

  static success(content) {
    return new CallToolResult(content, false);
  }

  static error(content) {
    return new CallToolResult(content, true);
  }
}

/**
 * 工具列表结果
 */
class ListToolsResult {
  constructor(tools) {
    this.tools = tools;
  }
}

/**
 * 解析 JSON-RPC 消息
 * @param {string} jsonString - JSON 字符串
 * @returns {JsonRpcRequest|JsonRpcNotification} 解析后的消息
 */
function parseJsonRpcMessage(jsonString) {
  let json;

  try {
    json = JSON.parse(jsonString);
  } catch (error) {
    throw JsonRpcError.parseError(error.message);
  }

  // 检查是否有 id 字段来判断是请求还是通知
  if (json.id !== undefined) {
    return JsonRpcRequest.fromJSON(json);
  } else {
    return JsonRpcNotification.fromJSON(json);
  }
}

/**
 * 序列化 JSON-RPC 消息
 * @param {Object} message - 要序列化的消息
 * @returns {string} JSON 字符串
 */
function serializeJsonRpcMessage(message) {
  try {
    return JSON.stringify(message);
  } catch (error) {
    throw JsonRpcError.internalError(`序列化失败: ${error.message}`);
  }
}

module.exports = {
  MCP_VERSION,
  ErrorCodes,
  JsonRpcError,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  ServerInfo,
  ClientInfo,
  ServerCapabilities,
  ClientCapabilities,
  InitializeResult,
  Tool,
  ToolContent,
  CallToolResult,
  ListToolsResult,
  parseJsonRpcMessage,
  serializeJsonRpcMessage
};
