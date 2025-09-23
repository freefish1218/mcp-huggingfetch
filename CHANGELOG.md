# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-09-24

### Added
- 增强文件列表功能支持递归目录遍历
- 新增目录信息到返回结果中
- 改进过滤逻辑，区分下载模式和列表模式

### Changed
- 优化path参数处理逻辑，支持从API URL路径直接过滤
- 改进getFileList方法支持递归获取子目录文件
- 增强filterFiles方法，支持allowEmpty参数控制

### Improved
- npm发布工作流使用npm install替代npm ci提升兼容性

## [1.2.1] - 2025-08-16

### Changed
- 优化 GitHub Actions 工作流触发条件，支持推送时自动发布
- 清理 README 中的无效测试徽章显示

### Fixed
- 修复所有语言版本 README 中的无效测试工作流徽章引用
- 修复 npm publish 工作流的自动触发配置

## [1.2.0] - 2025-08-16

### Added
- 自动化发布流程和 GitHub Actions 工作流
- npm 徽章显示到所有 README 文件
- 发布文档和脚本 (docs/RELEASE.md)
- .npmignore 文件优化发布包大小
- Glama.ai 社区徽章集成
- 多语言 README 支持 (中文、日文、法文、德文)

### Changed
- 重构 README 为英文版本作为主版本
- 优化下载性能和稳定性
- 增强异常处理机制

### Fixed
- 性能优化和稳定性改进

## [1.1.0] - 2025-08-15

### Added
- 核心下载功能
- MCP 服务器协议支持
- 智能重试和断点续传
- 并发下载优化

## [1.0.0] - 2025-08-14

### Added
- 初始版本发布
- 基础 HuggingFace 模型下载功能
- MCP 协议实现