/**
 * 配置模块测试
 */

const { AppConfig, getConfig, reloadConfig, checkEnvironment } = require('../src/core/config');

describe('配置管理', () => {
  beforeEach(() => {
    // 清理环境变量
    delete process.env.HUGGINGFACE_TOKEN;
    delete process.env.HF_TOKEN;
    delete process.env.HUGGINGFETCH_DOWNLOAD_DIR;
    delete process.env.HF_HOME;
    delete process.env.HF_DOWNLOAD_TIMEOUT;
  });

  describe('AppConfig', () => {
    test('应该创建默认配置', () => {
      const config = new AppConfig();
      
      expect(config.hf_token).toBe('');
      expect(config.download_dir).toBeTruthy();
      expect(config.hf_home).toBeTruthy();
      expect(config.download_timeout).toBe(300);
    });

    test('应该从环境变量读取配置', () => {
      process.env.HUGGINGFACE_TOKEN = 'test_token';
      process.env.HUGGINGFETCH_DOWNLOAD_DIR = '/test/downloads';
      process.env.HF_HOME = '/test/cache';
      process.env.HF_DOWNLOAD_TIMEOUT = '600';

      const config = new AppConfig();
      
      expect(config.hf_token).toBe('test_token');
      expect(config.download_dir).toBe('/test/downloads');
      expect(config.hf_home).toBe('/test/cache');
      expect(config.download_timeout).toBe(600);
    });

    test('应该支持 HF_TOKEN 作为 token 来源', () => {
      process.env.HF_TOKEN = 'hf_token';
      
      const config = new AppConfig();
      expect(config.hf_token).toBe('hf_token');
    });

    test('应该生成配置摘要', () => {
      process.env.HUGGINGFACE_TOKEN = 'secret_token';
      
      const config = new AppConfig();
      const summary = config.getSummary();
      
      expect(summary.has_token).toBe(true);
      expect(summary.download_dir).toBeTruthy();
      expect(summary.hf_home).toBeTruthy();
      expect(summary.download_timeout).toBe(300);
      expect(summary.hf_token).toBeUndefined(); // 不应该暴露 token
    });

    test('应该导出环境变量', () => {
      process.env.HUGGINGFACE_TOKEN = 'test_token';
      process.env.HF_HOME = '/test/cache';
      
      const config = new AppConfig();
      const envVars = config.toEnvVars();
      
      expect(envVars.HUGGINGFACE_TOKEN).toBe('test_token');
      expect(envVars.HF_HOME).toBe('/test/cache');
    });
  });

  describe('getConfig', () => {
    test('应该返回单例配置实例', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      
      expect(config1).toBe(config2);
    });
  });

  describe('reloadConfig', () => {
    test('应该创建新的配置实例', () => {
      const config1 = getConfig();
      const config2 = reloadConfig();
      
      expect(config1).not.toBe(config2);
    });
  });

  describe('checkEnvironment', () => {
    test('应该检测缺失的 token', () => {
      const result = checkEnvironment();
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('HUGGINGFACE_TOKEN 环境变量未设置');
    });

    test('应该检测完整的配置', () => {
      process.env.HUGGINGFACE_TOKEN = 'test_token';
      process.env.HUGGINGFETCH_DOWNLOAD_DIR = '/test/downloads';
      process.env.HF_HOME = '/test/cache';
      
      // 重新加载配置以应用新的环境变量
      reloadConfig();
      
      const result = checkEnvironment();
      
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.config).toBeTruthy();
    });

    test('应该生成合理的警告', () => {
      process.env.HUGGINGFACE_TOKEN = 'test_token';
      
      // 重新加载配置以应用新的环境变量
      reloadConfig();
      
      const result = checkEnvironment();
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('下载目录未配置'))).toBe(true);
    });
  });
});