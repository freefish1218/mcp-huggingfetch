# 发布指南

本项目支持多种自动化发布方式，让 npm 包发布变得简单高效。

## 🚀 快速发布

### 方式 1: 本地命令行发布（推荐日常使用）

```bash
# 发布补丁版本 (1.0.0 -> 1.0.1)
npm run release:patch

# 发布次要版本 (1.0.0 -> 1.1.0)
npm run release:minor

# 发布主要版本 (1.0.0 -> 2.0.0)
npm run release:major
```

脚本会自动：
1. 检查未提交的更改
2. 运行测试和代码检查
3. 更新版本号
4. 创建 Git 标签
5. 推送到 GitHub
6. 发布到 npm

### 方式 2: GitHub Actions 界面发布

1. 访问项目的 [Actions 页面](https://github.com/freefish1218/mcp-huggingfetch/actions)
2. 选择 "Version Bump & Release" 工作流
3. 点击 "Run workflow"
4. 选择版本类型（patch/minor/major）
5. 确认发布到 npm
6. 点击运行

### 方式 3: GitHub Release 触发

创建新的 GitHub Release 会自动触发 npm 发布：

```bash
# 使用 GitHub CLI
gh release create v1.2.0 --generate-notes

# 或在 GitHub 网页界面创建 Release
```

## 🔑 配置 NPM Token

### 获取 NPM Token

1. 登录 [npmjs.com](https://www.npmjs.com/)
2. 点击头像 → Access Tokens
3. 点击 "Generate New Token"
4. 选择 "Automation" 类型
5. 复制生成的 token

### 配置 GitHub Secrets

1. 访问项目的 Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 名称：`NPM_TOKEN`
4. 值：粘贴你的 npm token
5. 点击 "Add secret"

### 本地配置（可选）

如果需要在本地使用发布脚本：

```bash
# 登录 npm
npm login

# 验证登录状态
npm whoami
```

## 📋 发布前检查清单

- [ ] 所有测试通过
- [ ] 代码检查无错误
- [ ] README 已更新
- [ ] CHANGELOG 已更新（如有）
- [ ] 版本号符合语义化版本规范

## 🏷️ 版本号规范

遵循[语义化版本](https://semver.org/lang/zh-CN/)：

- **MAJOR** (x.0.0): 不兼容的 API 更改
- **MINOR** (1.x.0): 向后兼容的功能新增
- **PATCH** (1.0.x): 向后兼容的问题修复

## 🔄 回滚发布

如果需要回滚：

```bash
# 撤销 npm 发布（24小时内）
npm unpublish mcp-huggingfetch@<version>

# 或标记为废弃
npm deprecate mcp-huggingfetch@<version> "请使用更新的版本"
```

## 🐛 故障排除

### npm 发布失败

1. 检查 NPM_TOKEN 是否正确配置
2. 确认包名未被占用
3. 验证 package.json 格式正确

### GitHub Actions 失败

查看 Actions 日志：
- 点击失败的工作流运行
- 查看详细错误信息
- 检查 secrets 配置

### 本地脚本失败

```bash
# 检查 npm 登录状态
npm whoami

# 手动发布测试
npm publish --dry-run
```

## 📚 相关链接

- [npm 包页面](https://www.npmjs.com/package/mcp-huggingfetch)
- [GitHub Releases](https://github.com/freefish1218/mcp-huggingfetch/releases)
- [GitHub Actions](https://github.com/freefish1218/mcp-huggingfetch/actions)