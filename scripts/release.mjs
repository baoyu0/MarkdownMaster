import fs from 'fs/promises';
import { execSync } from 'child_process';
import semver from 'semver';

async function release(releaseType = 'patch') {
    try {
        // 读取当前版本
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
        const currentVersion = packageJson.version;

        // 计算新版本
        const newVersion = semver.inc(currentVersion, releaseType);
        console.log(`Releasing new version: ${newVersion}`);

        // 更新版本号
        await updateVersions(newVersion);

        // 构建项目
        execSync('npm run build', { stdio: 'inherit' });

        // 提交更改
        execSync('git add .', { stdio: 'inherit' });
        execSync(`git commit -m "Release v${newVersion}"`, { stdio: 'inherit' });
        execSync(`git tag v${newVersion}`, { stdio: 'inherit' });

        // 推送更改和标签
        execSync('git push && git push --tags', { stdio: 'inherit' });

        console.log(`Version ${newVersion} has been released successfully!`);
    } catch (error) {
        console.error(`Release failed: ${error.message}`);
        process.exit(1);
    }
}

async function updateVersions(version) {
    const files = ['package.json', 'manifest.json'];
    for (const file of files) {
        const content = JSON.parse(await fs.readFile(file, 'utf8'));
        content.version = version;
        await fs.writeFile(file, JSON.stringify(content, null, 2));
    }
}

// 获取命令行参数
const releaseType = process.argv[2] || 'patch';
release(releaseType);