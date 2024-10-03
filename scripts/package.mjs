import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';

async function packagePlugin() {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    const version = packageJson.version;
    const pluginName = packageJson.name;

    const zip = new AdmZip();

    // 添加必要的文件到 ZIP
    const filesToInclude = ['main.js', 'manifest.json', 'styles.css'];
    for (const file of filesToInclude) {
        if (await fs.stat(file).catch(() => false)) {
            zip.addLocalFile(file);
        }
    }

    // 确保 release 目录存在
    await fs.mkdir('release', { recursive: true });

    // 创建 ZIP 文件
    const zipPath = path.join('release', `${pluginName}-${version}.zip`);
    zip.writeZip(zipPath);

    console.log(`Plugin packaged: ${zipPath}`);
}

packagePlugin().catch(console.error);