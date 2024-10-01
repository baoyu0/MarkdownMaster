const fs = require('fs');
const path = require('path');

const pluginName = 'markdown-master';
const releaseDir = path.join(__dirname, '..', pluginName);

// 创建插件目录
if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
}

// 复制必要的文件
['main.js', 'manifest.json', 'styles.css'].forEach(file => {
    fs.copyFileSync(path.join(__dirname, '..', file), path.join(releaseDir, file));
});

// 创建 data.json（如果不存在）
const dataJsonPath = path.join(releaseDir, 'data.json');
if (!fs.existsSync(dataJsonPath)) {
    fs.writeFileSync(dataJsonPath, JSON.stringify({
        // 在这里添加默认的插件配置
    }, null, 2));
}

console.log(`Release package prepared in ${releaseDir}`);