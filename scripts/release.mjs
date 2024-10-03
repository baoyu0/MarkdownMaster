import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const updateVersionInFile = (filePath, newVersion) => {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.version = newVersion;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
};

try {
    // 获取最新的 git tag 作为版本号
    const latestTag = execSync('git describe --tags --abbrev=0').toString().trim();
    const newVersion = latestTag.startsWith('v') ? latestTag.slice(1) : latestTag;

    console.log(`Releasing new version: ${newVersion}`);

    // 更新文件中的版本号
    updateVersionInFile('package.json', newVersion);
    updateVersionInFile('manifest.json', newVersion);

    // 构建和打包
    execSync('npm run build', { stdio: 'inherit' });
    execSync('npm run package', { stdio: 'inherit' });

    // 提交更改
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "Release ${newVersion}"`, { stdio: 'inherit' });

    // 创建新标签
    execSync(`git tag ${newVersion}`, { stdio: 'inherit' });

    // 推送提交
    execSync('git push', { stdio: 'inherit' });

    // 推送标签，忽略错误
    try {
        execSync('git push --tags', { stdio: 'inherit' });
    } catch (tagError) {
        console.warn('Warning: Some tags failed to push. This is often normal if they already exist remotely.');
    }

    console.log(`Successfully released version ${newVersion}`);
} catch (error) {
    console.error('Release failed:', error.message);
    process.exit(1);
}