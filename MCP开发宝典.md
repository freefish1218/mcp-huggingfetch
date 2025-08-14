# MCP 开发宝典 - 从零到一构建无 Bug 的 MCP 服务器

## 📚 前言

本宝典基于 `mcp-huggingfetch` 项目的开发经验总结，涵盖了 MCP（Model Context Protocol）服务器开发的全流程最佳实践、常见陷阱及解决方案。遵循本指南，可帮助开发者一次性完成高质量的 MCP 服务器开发。

## 🎯 核心理念

**MCP 服务器的本质**：通过 stdin/stdout 进行 JSON-RPC 2.0 通信的标准化工具服务器

**关键成功要素**：
1. **纯净的通信通道** - stdout 只用于 MCP 协议通信
2. **完善的错误处理** - 任何异常都不能污染 stdout
3. **严格的协议遵循** - 精确实现 JSON-RPC 2.0 规范
4. **智能的日志管理** - 生产环境零控制台输出

## 🏗️ 架构设计

### 1. 标准项目结构

```
your-mcp-project/
├── bin/
│   └── cli.js                 # CLI 入口点（设置环境，启动服务器）
├── src/
│   ├── index.js               # 主入口（用于直接运行）
│   ├── mcp/
│   │   ├── server.js          # MCP 服务器核心实现
│   │   ├── tools.js           # 工具定义和实现
│   │   └── types.js           # 协议类型定义
│   ├── core/
│   │   ├── [你的业务逻辑].js  # 核心功能实现
│   │   └── config.js          # 配置管理
│   └── utils/
│       ├── logger.js          # 日志系统
│       ├── validation.js      # 输入验证
│       └── helpers.js         # 辅助函数
├── tests/
│   ├── basic.test.js          # 基础功能测试
│   └── test-mcp.js            # MCP 协议测试
├── scripts/
│   ├── diagnose-mcp.js        # 诊断工具
│   └── setup-claude.js        # 配置助手
└── package.json
```

### 2. 关键模块职责

- **MCP 层**：处理协议通信，不包含业务逻辑
- **Core 层**：实现核心功能，与 MCP 协议无关
- **Utils 层**：提供通用支持功能

## 💡 开发要点

### 1. 环境隔离 - 最重要的原则

```javascript
// bin/cli.js - 启动前设置 MCP 模式标志
process.env.MCP_MODE = 'true';

// 为兼容性设置默认值
if (!process.env.YOUR_REQUIRED_ENV) {
  process.env.YOUR_REQUIRED_ENV = 'default_placeholder';
}

// 日志输出到文件，不污染 stdout
if (!process.env.MCP_LOG_FILE) {
  process.env.MCP_LOG_FILE = path.join(os.tmpdir(), 'your-mcp.log');
}
```

### 2. 通信管道纯净性

```javascript
// server.js - 正确的输出方式
class McpServer {
  run() {
    const rl = readline.createInterface({
      input: process.stdin,
      crlfDelay: Infinity
      // 注意：不设置 output，避免干扰 stdout
    });

    rl.on('line', async (line) => {
      const response = await this.handleMessage(line);
      if (response) {
        // 使用 process.stdout.write 确保纯净输出
        process.stdout.write(response + '\n');
      }
    });
  }
}
```

### 3. 完整的协议实现

```javascript
// types.js - 关键类型定义
class ServerCapabilities {
  constructor() {
    this.tools = null;
    // 即使不支持，也要设置空对象避免客户端报错
    this.resources = {};
    this.prompts = {};
  }
}

// 正确的初始化响应
handleInitialize(request) {
  const capabilities = new ServerCapabilities()
    .setToolsCapability(true);
  
  const serverInfo = new ServerInfo(
    'your-mcp-server',
    require('../../package.json').version
  );
  
  const result = new InitializeResult(
    MCP_VERSION,  // 使用正确的协议版本
    capabilities,
    serverInfo
  );
  
  return JsonRpcResponse.success(request.id, result);
}
```

### 4. 错误处理策略

```javascript
// 三层错误防护
async handleMessage(message) {
  try {
    // 第一层：解析错误
    const jsonMessage = parseJsonRpcMessage(message);
    
    // 第二层：处理错误
    const response = await this.handleRequest(jsonMessage);
    return serializeJsonRpcMessage(response);
    
  } catch (error) {
    // 第三层：兜底错误处理
    if (error instanceof JsonRpcError) {
      return serializeJsonRpcMessage(
        JsonRpcResponse.error('unknown', error)
      );
    } else {
      return serializeJsonRpcMessage(
        JsonRpcResponse.error('unknown', 
          JsonRpcError.internalError(error.message)
        )
      );
    }
  }
}
```

### 5. 日志系统设计

```javascript
// logger.js - 智能日志系统
function createLogger() {
  const isMcpMode = process.env.MCP_MODE === 'true' || 
                     process.env.NODE_ENV === 'production';
  
  if (isMcpMode) {
    // MCP 模式：输出到文件
    return winston.createLogger({
      transports: [
        new winston.transports.File({
          filename: process.env.MCP_LOG_FILE,
          maxsize: 5242880,  // 5MB
          maxFiles: 1
        })
      ]
    });
  } else {
    // 开发模式：输出到 stderr
    return winston.createLogger({
      transports: [
        new winston.transports.Console({
          stderrLevels: ['error', 'warn', 'info', 'debug']
        })
      ]
    });
  }
}
```

## ⚠️ 常见陷阱及解决方案

### 陷阱 1：stdout 污染

**问题**：任何 `console.log` 都会破坏 MCP 通信

**解决**：
```javascript
// ❌ 错误
console.log('Server started');  // 污染 stdout

// ✅ 正确
logger.info('Server started');  // 输出到日志文件
```

### 陷阱 2：初始化顺序错误

**问题**：在 `initialized` 通知前调用工具

**解决**：
```javascript
handleCallTool(request) {
  if (!this.initialized) {
    return JsonRpcResponse.error(
      request.id,
      JsonRpcError.internalError('服务器未初始化')
    );
  }
  // 处理工具调用
}
```

### 陷阱 3：异步错误逃逸

**问题**：未捕获的 Promise 拒绝导致服务器崩溃

**解决**：
```javascript
// 全局异常捕获
process.on('unhandledRejection', (reason, promise) => {
  if (process.env.MCP_MODE === 'true') {
    process.stderr.write(`Fatal error: ${reason}\n`);
  }
  logger.error('未处理的 Promise 拒绝:', reason);
  process.exit(1);
});
```

### 陷阱 4：参数验证不足

**问题**：无效参数导致运行时错误

**解决**：
```javascript
// 使用 Joi 进行严格验证
const schema = Joi.object({
  repo_id: Joi.string().required()
    .pattern(/^[^/]+\/[^/]+$/)
    .messages({
      'string.pattern.base': 'repo_id 格式必须为: 用户名/仓库名'
    }),
  files: Joi.array().items(Joi.string()).optional()
});

const { error, value } = schema.validate(args);
if (error) {
  return CallToolResult.error(
    ToolContent.text(`参数错误: ${error.message}`)
  );
}
```

### 陷阱 5：敏感信息泄露

**问题**：Token 等敏感信息出现在日志中

**解决**：
```javascript
// 过滤敏感信息
function safeLog(logger, level, message) {
  const sensitivePatterns = [
    /hf_[a-zA-Z0-9]{34}/g,  // HuggingFace tokens
    /token[=:]\s*[^\s]+/gi,
    /password[=:]\s*[^\s]+/gi
  ];
  
  let safeMessage = message;
  sensitivePatterns.forEach(pattern => {
    safeMessage = safeMessage.replace(pattern, '[REDACTED]');
  });
  
  logger[level](safeMessage);
}
```

## 🧪 测试策略

### 1. 基础功能测试

```javascript
// tests/basic.test.js
const { McpServer } = require('../src/mcp/server');
const { getConfig } = require('../src/core/config');

// 测试模块导入
console.log('✅ 模块导入成功');

// 测试服务器创建
const server = new McpServer();
console.log('✅ MCP 服务器创建成功');
console.log('服务器状态:', server.getStatus());
```

### 2. 协议通信测试

```javascript
// scripts/test-mcp.js
const testMessages = [
  // 初始化
  {
    jsonrpc: '2.0',
    id: 'init',
    method: 'initialize',
    params: { protocolVersion: '2024-11-05' }
  },
  // 通知
  {
    jsonrpc: '2.0',
    method: 'initialized'
  },
  // 工具列表
  {
    jsonrpc: '2.0',
    id: 'tools',
    method: 'tools/list'
  }
];

// 发送并验证响应
```

### 3. 诊断工具

```javascript
// scripts/diagnose-mcp.js
// 检查清单：
// 1. 环境变量配置
// 2. Node.js 版本 (>= 18)
// 3. 依赖包安装
// 4. 文件完整性
// 5. 协议通信测试
// 6. 生成配置建议
```

## 📦 打包发布

### package.json 关键配置

```json
{
  "name": "mcp-your-tool",
  "version": "1.0.0",
  "bin": {
    "mcp-your-tool": "bin/cli.js"
  },
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "jest",
    "test:basic": "node tests/basic.test.js",
    "test:mcp": "node scripts/test-mcp.js",
    "lint": "eslint src/ bin/",
    "prepublishOnly": "npm test && npm run lint"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "files": [
    "src/",
    "bin/",
    "README.md",
    "LICENSE"
  ]
}
```

## 🔧 调试技巧

### 1. 开发环境调试

```bash
# 设置调试环境变量
export LOG_LEVEL=debug
export MCP_MODE=false  # 关闭 MCP 模式，启用控制台输出

# 运行测试
npm run test:mcp
```

### 2. 生产环境调试

```bash
# 查看日志文件
tail -f /tmp/mcp-your-tool.log

# 诊断连接问题
npm run diagnose
```

### 3. 客户端配置调试

```json
// Claude Code 配置示例
{
  "mcpServers": {
    "your-tool": {
      "command": "node",
      "args": ["/absolute/path/to/bin/cli.js"],
      "env": {
        "LOG_LEVEL": "debug",
        "MCP_LOG_FILE": "/tmp/mcp-debug.log"
      }
    }
  }
}
```

## ✅ 开发检查清单

发布前确保完成以下检查：

- [ ] **通信纯净性**
  - [ ] 无 console.log 污染 stdout
  - [ ] 所有输出使用 process.stdout.write
  - [ ] 错误信息输出到 stderr

- [ ] **协议完整性**
  - [ ] 实现 initialize 方法
  - [ ] 处理 initialized 通知
  - [ ] 实现 tools/list 方法
  - [ ] 实现 tools/call 方法
  - [ ] 所有响应包含正确的 jsonrpc: "2.0"

- [ ] **错误处理**
  - [ ] 所有异步操作有 try-catch
  - [ ] 全局异常捕获器设置
  - [ ] 返回标准 JSON-RPC 错误

- [ ] **日志系统**
  - [ ] MCP 模式下输出到文件
  - [ ] 敏感信息过滤
  - [ ] 适当的日志级别

- [ ] **测试覆盖**
  - [ ] 基础功能测试通过
  - [ ] MCP 协议测试通过
  - [ ] 诊断工具运行正常

- [ ] **文档完善**
  - [ ] README 包含配置示例
  - [ ] 工具描述清晰准确
  - [ ] 参数说明完整

## 🎓 进阶技巧

### 1. 工具参数设计

```javascript
// 支持灵活的参数类型
{
  allow_patterns: {
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' } }
    ],
    description: '支持单个字符串或字符串数组',
    examples: ['*.json', ['*.safetensors', '*.bin']]
  }
}
```

### 2. 进度反馈

```javascript
// 通过工具结果返回进度信息
return CallToolResult.success(
  ToolContent.text(JSON.stringify({
    success: true,
    progress_events: [
      { percent: 0, message: '开始下载' },
      { percent: 50, message: '下载中...' },
      { percent: 100, message: '下载完成' }
    ]
  }))
);
```

### 3. 批量操作优化

```javascript
// 并发处理提高效率
const results = await Promise.all(
  files.map(file => this.processFile(file))
);
```

## 📚 参考资源

- [MCP 协议规范](https://github.com/anthropics/mcp-specification)
- [JSON-RPC 2.0 规范](https://www.jsonrpc.org/specification)
- [Claude MCP 文档](https://docs.anthropic.com/mcp)

## 🏆 总结

成功的 MCP 服务器开发关键在于：

1. **保持 stdout 纯净** - 这是最重要的原则
2. **严格遵循协议** - 不要创新，要兼容
3. **完善错误处理** - 任何错误都不能让服务器崩溃
4. **充分测试验证** - 使用提供的测试工具
5. **详细日志记录** - 方便问题排查

遵循本宝典，您将能够一次性开发出稳定、高质量的 MCP 服务器！

---

*本宝典基于 mcp-huggingfetch v1.0.0 项目经验总结*
*贡献者：MCP HuggingFetch 开发团队*
*最后更新：2025-08-14*