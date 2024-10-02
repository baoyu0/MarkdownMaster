import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';

const targetDir = './release';

// 读取 manifest.json 获取版本号
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const version = manifest.version;

// 创建发布目录
mkdirSync(targetDir, { recursive: true });

// 创建 zip 文件
const zip = new AdmZip();

// 添加必要的文件
zip.addLocalFile('main.js');
zip.addLocalFile('manifest.json');
zip.addLocalFile('styles.css');

// 写入 zip 文件
const zipFilename = `markdown-master-${version}.zip`;
zip.writeZip(`${targetDir}/${zipFilename}`);

console.log(`Plugin packaged: ${zipFilename}`);