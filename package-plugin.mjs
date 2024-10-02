import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'fs';
import AdmZip from 'adm-zip';
import path from 'path';

const targetDir = './release';

// 读取 manifest.json 获取版本号
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const version = manifest.version;

// 清理旧的发布目录
rmSync(targetDir, { recursive: true, force: true });

// 创建新的发布目录
mkdirSync(targetDir, { recursive: true });

// 创建临时目录用于组织文件
const tempDir = path.join(targetDir, 'markdown-master');
mkdirSync(tempDir, { recursive: true });

// 复制必要的文件到临时目录
const filesToCopy = ['main.js', 'manifest.json', 'styles.css'];
filesToCopy.forEach(file => {
    copyFileSync(file, path.join(tempDir, file));
});

// 创建 zip 文件
const zip = new AdmZip();

// 添加整个临时目录到 zip
zip.addLocalFolder(tempDir);

// 写入 zip 文件
const zipFilename = `markdown-master-${version}.zip`;
zip.writeZip(path.join(targetDir, zipFilename));

// 清理临时目录
rmSync(tempDir, { recursive: true, force: true });

console.log(`Plugin packaged: ${zipFilename}`);