import fs from 'fs/promises';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

async function release(version) {
    // 更新版本号
    await updateVersions(version);
    
    // 构建项目
    execSync('npm run build', { stdio: 'inherit' });
    
    // 打包插件
    execSync('npm run package', { stdio: 'inherit' });
    
    // 验证生成的ZIP文件
    const zipFilename = `markdown-master-${version}.zip`;
    const zipPath = path.join('./release', zipFilename);
    if (!fs.existsSync(zipPath)) {
        throw new Error(`Expected ZIP file not found: ${zipPath}`);
    }
    console.log(`Verified: ${zipFilename} has been created successfully.`);

    // Git 操作
    gitOperations(version);
    
    console.log(`Version ${version} has been released successfully!`);
}

async function updateVersions(version) {
    const files = ['package.json', 'manifest.json', 'versions.json'];
    for (const file of files) {
        const content = JSON.parse(await fs.readFile(file, 'utf8'));
        if (file === 'versions.json') {
            content[version] = packageJson.minAppVersion;
        } else {
            content.version = version;
        }
        await fs.writeFile(file, JSON.stringify(content, null, 2));
    }
}

function gitOperations(version) {
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "Release v${version}"`, { stdio: 'inherit' });
    execSync(`git tag v${version}`, { stdio: 'inherit' });
    execSync('git push && git push --tags', { stdio: 'inherit' });
}

// 获取版本号参数
const version = process.argv[2];
if (!version) {
    console.error('Please provide a version number');
    process.exit(1);
}

release(version).catch(console.error);