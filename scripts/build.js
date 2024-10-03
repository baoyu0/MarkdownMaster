const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

// 获取版本号
const version = packageJson.version;

// 构建 ZIP 文件名
const zipFileName = `markdown-master-${version}.zip`;

// 创建 ZIP 文件
// ... ZIP 文件创建逻辑

console.log(`Created ${zipFileName}`);