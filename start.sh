#!/bin/bash
echo "正在启动颐馨园养老管理系统..."
open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null || echo "请手动访问 http://localhost:3000"
node server.js
