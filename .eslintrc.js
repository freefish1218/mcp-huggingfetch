module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    // 允许 console 输出（对于 CLI 工具是必要的）
    'no-console': 'off',
    
    // 允许空的 catch 块（某些情况下需要）
    'no-empty': ['error', { 'allowEmptyCatch': true }],
    
    // 强制使用分号
    'semi': ['error', 'always'],
    
    // 允许在条件语句中使用赋值
    'no-cond-assign': 'off',
    
    // 允许使用 async-await
    'require-await': 'error',
    
    // 强制一致的缩进
    'indent': ['error', 2],
    
    // 强制使用单引号
    'quotes': ['error', 'single'],
    
    // 在数组和对象的最后一个元素后面加逗号
    'comma-dangle': ['error', 'never'],
    
    // 强制在关键字前后使用空格
    'keyword-spacing': 'error',
    
    // 强制在代码块的开始和结束位置使用空格
    'space-before-blocks': 'error',
    
    // 要求或禁止函数圆括号之前有一个空格
    'space-before-function-paren': ['error', 'never'],
    
    // 强制操作符周围有空格
    'space-infix-ops': 'error',
    
    // 禁止出现多个空行
    'no-multiple-empty-lines': ['error', { 'max': 2, 'maxEOF': 1 }],
    
    // 禁止行尾空白
    'no-trailing-spaces': 'error',
    
    // 要求文件末尾存在空行
    'eol-last': 'error'
  },
  overrides: [
    {
      files: ['tests/**/*.js', '**/*.test.js'],
      rules: {
        // 测试文件中允许使用一些特殊的模式
        'no-unused-expressions': 'off'
      }
    }
  ]
};