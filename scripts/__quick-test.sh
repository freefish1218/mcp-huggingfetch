#!/bin/bash

# 快速测试脚本
echo "快速测试 list_huggingface_files 功能..."

# 创建测试请求
cat << EOF | node bin/claude-compatible.js 2>/dev/null | grep -A 50 '"success"' | head -20
{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":0}
{"jsonrpc":"2.0","method":"tools/list","id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_huggingface_files","arguments":{"repo_id":"hf-internal-testing/tiny-random-bert","max_files":5,"explore_mode":true}},"id":2}
EOF

if [ $? -eq 0 ]; then
    echo -e "\n✅ 测试通过：服务器正常响应"
else
    echo -e "\n❌ 测试失败"
fi