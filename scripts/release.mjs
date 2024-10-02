import fs from 'fs/promises';
import { existsSync } from 'fs';  // 添加这一行
import { execSync } from 'child_process';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

async function verifyVersionConsistency(version) {
    const files = ['package.json', 'manifest.json', 'versions.json'];
    for (const file of files) {
        const content = JSON.parse(await fs.readFile(file, 'utf8'));
        if (file !== 'versions.json' && content.version !== version) {
            throw new Error(`Version mismatch in ${file}: expected ${version}, got ${content.version}`);
        }
    }
    console.log('Version consistency verified across all files.');
}

async function release(version) {
    await verifyVersionConsistency(version);
    await updateVersions(version);
    
    execSync('npm run build', { stdio: 'inherit' });
    execSync('npm run package', { stdio: 'inherit' });
    
    // 再次验证版本一致性
    await verifyVersionConsistency(version);
    
    // 验证生成的ZIP文件
    const zipFilename = `markdown-master-${version}.zip`;
    const zipPath = path.join('./release', zipFilename);
    if (!existsSync(zipPath)) {  // 这里改为 existsSync
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