import fs from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

async function getPackageVersion() {
    const packageJsonPath = path.resolve('package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    return packageJson.version;
}

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

async function release() {
    try {
        // 获取最新版本号
        const version = await getPackageVersion();
        console.log(`Starting release for version: ${version}`);

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
        if (!existsSync(zipPath)) {
            throw new Error(`Expected ZIP file not found: ${zipPath}`);
        }
        console.log(`Verified: ${zipFilename} has been created successfully.`);

        // 执行Git操作
        await gitOperations(version);

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
            content[version] = content.minAppVersion; // 确保 versions.json 正确更新
        } else {
            content.version = version;
        }
        await fs.writeFile(filePath, JSON.stringify(content, null, 2));
        console.log(`${file} 的版本已更新为 ${version}`);
    }
}

async function gitOperations(version) {
    console.log('Performing Git operations...');

    // 检查标签是否已存在
    let tagExists = false;
    try {
        execSync(`git rev-parse v${version}`, { stdio: 'ignore' });
        tagExists = true;
    } catch (error) {
        tagExists = false;
    }

    if (tagExists) {
        console.warn(`标签 v${version} 已存在，跳过创建标签。`);
    } else {
        execSync(`git tag v${version}`, { stdio: 'inherit' });
    }

    // 提交更改
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "Release v${version}"`, { stdio: 'inherit' });

    // 推送更改和标签
    if (!tagExists) {
        execSync('git push && git push --tags', { stdio: 'inherit' });
    } else {
        execSync('git push', { stdio: 'inherit' });
    }

    console.log('Git operations completed.');
}

// 执行发布
release().catch(console.error);