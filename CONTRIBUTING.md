# 贡献指南

欢迎为 MCP HuggingFetch 项目做出贡献！本指南将帮助您了解如何参与项目开发。

## 📋 目录

- [开始之前](#开始之前)
- [开发环境设置](#开发环境设置)
- [贡献类型](#贡献类型)
- [代码规范](#代码规范)
- [提交 Pull Request](#提交-pull-request)
- [报告问题](#报告问题)
- [测试指南](#测试指南)
- [发布流程](#发布流程)

## 🚀 开始之前

### 行为准则

参与本项目即表示您同意遵守我们的[行为准则](CODE_OF_CONDUCT.md)。请确保在所有互动中保持尊重和专业。

### 先决条件

- 熟悉 Rust 编程语言
- 了解 MCP (Model Context Protocol) 协议
- 具备 Git 和 GitHub 使用经验
- 理解 HuggingFace 生态系统

## 🛠 开发环境设置

### 1. 克隆仓库

```bash
git clone https://github.com/your-org/mcp-huggingfetch.git
cd mcp-huggingfetch
```

### 2. 安装依赖

确保您的系统安装了以下工具：

- **Rust 1.70+**: 使用 [rustup](https://rustup.rs/) 安装
- **Python 3.11+**: 用于测试和开发
- **Git**: 版本控制

```bash
# 检查 Rust 版本
rustc --version

# 安装必要的 Rust 组件
rustup component add clippy rustfmt

# 构建项目
cargo build
```

### 3. 运行测试

```bash
# 运行所有测试
cargo test

# 运行特定测试
cargo test --test unit_tests
cargo test --test integration_tests

# 代码格式检查
cargo fmt --check

# 静态分析
cargo clippy -- -D warnings
```

### 4. 设置环境变量

创建 `.env` 文件（**不要提交到版本控制**）：

```bash
# 必需：HuggingFace 访问令牌
HUGGINGFACE_TOKEN=hf_your_token_here

# 可选：自定义配置
HUGGINGFETCH_DOWNLOAD_DIR=./test_downloads
HF_HOME=./test_cache
RUST_LOG=debug
```

## 🎯 贡献类型

我们欢迎以下类型的贡献：

### 🐛 Bug 修复
- 修复现有功能中的错误
- 改进错误处理和边界情况
- 提高稳定性和可靠性

### ✨ 新功能
- 添加新的 MCP 工具
- 增强下载功能
- 改进用户体验

### 📚 文档改进
- 更新 README 和 API 文档
- 添加使用示例
- 改进注释和代码文档

### 🧪 测试增强
- 增加测试覆盖率
- 添加集成测试
- 改进测试质量

### ⚡ 性能优化
- 提高下载速度
- 减少内存使用
- 优化启动时间

## 📝 代码规范

### Rust 代码风格

我们使用标准的 Rust 代码风格：

```bash
# 自动格式化代码
cargo fmt

# 检查代码风格
cargo fmt --check
```

### 代码质量要求

1. **所有代码必须通过 `cargo clippy` 检查**
2. **新功能必须包含测试**
3. **公共 API 必须有文档注释**
4. **错误处理必须完善**
5. **输入验证必须严格**

### 注释规范

- **所有注释使用中文**
- 公共函数和结构体必须有文档注释
- 复杂逻辑需要内联注释解释
- 使用 `///` 进行文档注释，`//` 进行常规注释

```rust
/// 下载 HuggingFace 模型到指定目录
/// 
/// # 参数
/// 
/// * `options` - 下载选项配置
/// * `config` - 应用配置
/// 
/// # 返回值
/// 
/// 返回下载结果，包含成功状态和详细信息
/// 
/// # 错误
/// 
/// 当配置无效或下载失败时返回错误
pub async fn download_model(
    options: DownloadOptions,
    config: &AppConfig,
) -> Result<DownloadResult, String> {
    // 验证输入参数
    validate_download_options(&options)?;
    
    // 开始下载过程
    // ...
}
```

### 安全要求

- **绝不在日志中输出敏感信息**（Token、密码等）
- **所有用户输入必须验证和清理**
- **使用安全的文件路径操作**
- **防止路径遍历攻击**

## 🔄 提交 Pull Request

### 1. 分支命名规范

```bash
# Bug 修复
git checkout -b fix/issue-description

# 新功能
git checkout -b feature/feature-name

# 文档更新
git checkout -b docs/documentation-update

# 重构
git checkout -b refactor/component-name
```

### 2. 提交消息规范

使用[约定式提交](https://www.conventionalcommits.org/zh-hans/)格式：

```
类型(范围): 简短描述

详细描述（可选）

关闭的 Issue（可选）
```

示例：
```
feat(validation): 添加输入参数验证功能

- 实现 repo_id 格式验证
- 添加文件路径安全检查
- 增强错误消息提示

Closes #123
```

类型说明：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式化
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

### 3. PR 检查清单

在提交 PR 之前，请确保：

- [ ] 代码通过所有测试（`cargo test`）
- [ ] 代码通过格式检查（`cargo fmt --check`）
- [ ] 代码通过静态分析（`cargo clippy`）
- [ ] 新功能包含适当的测试
- [ ] 文档已更新（如适用）
- [ ] 提交消息符合规范
- [ ] PR 描述清晰，说明了变更内容和原因

### 4. PR 模板

创建 PR 时，请使用以下模板：

```markdown
## 📋 变更描述

简要描述此 PR 的变更内容。

## 🎯 变更类型

- [ ] Bug 修复
- [ ] 新功能
- [ ] 文档更新
- [ ] 重构
- [ ] 性能优化
- [ ] 测试改进

## 🧪 测试

- [ ] 现有测试通过
- [ ] 添加了新测试
- [ ] 手动测试通过

描述测试方法和结果。

## 📝 检查清单

- [ ] 代码符合项目规范
- [ ] 提交消息清晰明确
- [ ] 文档已更新
- [ ] 无敏感信息泄露

## 🔗 相关 Issue

关闭 #issue_number
```

## 🐛 报告问题

### 使用 Issue 模板

报告 Bug 时请提供：

1. **环境信息**
   - 操作系统版本
   - Rust 版本
   - 项目版本

2. **重现步骤**
   - 详细的操作步骤
   - 预期行为
   - 实际行为

3. **错误信息**
   - 完整的错误日志
   - 堆栈跟踪（如适用）

4. **最小重现示例**
   - 可重现问题的最小代码示例

### 功能请求

提交功能请求时请说明：

1. **问题描述**：当前缺少什么功能
2. **解决方案**：建议的实现方式
3. **替代方案**：考虑过的其他方法
4. **使用场景**：具体的使用案例

## 🧪 测试指南

### 测试分类

1. **单元测试**（`tests/unit_tests.rs`）
   - 测试单个函数和模块
   - 专注于逻辑正确性
   - 快速执行

2. **集成测试**（`tests/integration_tests.rs`）
   - 测试组件间交互
   - MCP 协议合规性
   - 端到端功能验证

### 编写测试

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_name() {
        // Arrange: 准备测试数据
        let input = "test_input";
        let expected = "expected_output";

        // Act: 执行被测试的功能
        let result = function_under_test(input);

        // Assert: 验证结果
        assert_eq!(result, expected);
    }

    #[tokio::test]
    async fn test_async_function() {
        // 异步函数测试
        let result = async_function().await;
        assert!(result.is_ok());
    }
}
```

### 测试最佳实践

- 每个测试应该独立且可重现
- 使用描述性的测试名称
- 测试边界条件和错误情况
- 避免依赖外部服务（使用 Mock）
- 清理测试产生的临时文件

## 🚀 发布流程

### 版本号规范

我们使用[语义化版本控制](https://semver.org/lang/zh-CN/)：

- **主版本号**：不兼容的 API 修改
- **次版本号**：向下兼容的功能新增
- **修订号**：向下兼容的问题修正

### 发布步骤

1. 更新 `Cargo.toml` 中的版本号
2. 更新 `CHANGELOG.md`
3. 创建 release 分支
4. 运行完整测试套件
5. 创建 Git 标签
6. 发布到 crates.io

## 🤝 社区

### 获取帮助

- **GitHub Issues**: 报告 Bug 或请求功能
- **GitHub Discussions**: 一般性问题和讨论
- **文档**: 查看项目文档和示例

### 贡献者认可

我们会在以下地方认可贡献者：

- README.md 中的贡献者列表
- 发布说明中感谢重要贡献
- GitHub 贡献统计

## 📄 许可证

通过向此项目贡献代码，您同意您的贡献将在 MIT 许可证下获得许可。

---

感谢您对 MCP HuggingFetch 项目的贡献！🎉