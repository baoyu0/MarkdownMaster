const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const pluginName = 'markdown-master';
const obsidianVaultPath = 'D:\\0-syncthing\\1-obsidian'; // 请替换为您的 Obsidian vault 路径

// 构建插件
console.log('构建插件...');
execSync('npm run build', { stdio: 'inherit' });

// 创建插件文件夹
const pluginDir = path.join(obsidianVaultPath, '.obsidian', 'plugins', pluginName);
if (!fs.existsSync(pluginDir)) {
    console.log('创建插件文件夹...');
    fs.mkdirSync(pluginDir, { recursive: true });
}

// 复制文件
console.log('复制文件...');
const filesToCopy = ['main.js', 'manifest.json', 'styles.css'];
filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join(pluginDir, file));
        console.log(`已复制 ${file}`);
    } else {
        console.log(`警告: ${file} 不存在，已跳过`);
    }
});

console.log('插件准备完成！');