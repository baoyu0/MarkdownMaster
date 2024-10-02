import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

// 获取当前版本号
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const version = packageJson.version;

// 创建新的ZIP包
const zip = new AdmZip();

// 添加必要的文件和文件夹
const filesToInclude = ['main.js', 'manifest.json', 'styles.css', 'README.md']; // 根据实际情况添加文件

filesToInclude.forEach(file => {
    const filePath = path.join('dist', file); // 假设构建后的文件在 'dist' 目录下
    if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
    } else {
        console.warn(`警告: ${filePath} 不存在，未被添加到ZIP包中。`);
    }
});

// 添加其他必要的资源，如图标等
const assetsPath = path.join('assets');
if (fs.existsSync(assetsPath)) {
    zip.addLocalFolder(assetsPath, 'assets');
}

// 保存ZIP包
const outputPath = path.join('release', `markdown-master-${version}.zip`);
zip.writeZip(outputPath);
console.log(`ZIP包已创建: ${outputPath}`);