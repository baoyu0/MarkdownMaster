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
    try {
        // 先更新所有文件的版本号
        await updateVersions(version);
        console.log('All files have been updated with the new version.');

        // 再验证版本一致性
        await verifyVersionConsistency(version);

        // 构建项目
        console.log('Running build script...');
        execSync('npm run build', { stdio: 'inherit' });

        // 打包插件
        console.log('Running package script...');
        execSync('npm run package', { stdio: 'inherit' });

        // 再次验证版本一致性
        await verifyVersionConsistency(version);

        // 验证生成的ZIP文件
        const zipFilename = `markdown-master-${version}.zip`;
        const zipPath = path.join('./release', zipFilename);
        if (!existsSync(zipPath)) {  // 使用 existsSync 检查文件是否存在
            throw new Error(`Expected ZIP file not found: ${zipPath}`);
        }
        console.log(`Verified: ${zipFilename} has been created successfully.`);

        // 执行Git操作
        gitOperations(version);

        console.log(`Version ${version} has been released successfully!`);
    } catch (error) {
        console.error(`Release failed: ${error.message}`);
        process.exit(1);
    }
}

async function updateVersions(version) {
    const files = ['package.json', 'manifest.json', 'versions.json'];
    for (const file of files) {
        const filePath = path.resolve(file);
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (file === 'versions.json') {
            content[version] = packageJson.minAppVersion;
        } else {
            content.version = version;
        }
        await fs.writeFile(filePath, JSON.stringify(content, null, 2));
        console.log(`${file} 的版本已更新为 ${version}`);
    }
}

function gitOperations(version) {
    console.log('Performing Git operations...');
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "Release v${version}"`, { stdio: 'inherit' });
    execSync(`git tag v${version}`, { stdio: 'inherit' });
    execSync('git push && git push --tags', { stdio: 'inherit' });
    console.log('Git operations completed.');
}

// 获取版本号参数
const version = packageJson.version;

if (!version) {
    console.error('无法从 package.json 中获取版本号');
    process.exit(1);
}

release(version).catch(console.error);