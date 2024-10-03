import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const updateVersionInFile = (filePath, newVersion) => {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.version = newVersion;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
};

try {
    console.log('Process arguments:', process.argv);

    // 获取 npm_config_new_version 环境变量
    const newVersion = process.env.npm_config_new_version;
    console.log('New version from env:', newVersion);

    if (!newVersion || newVersion === 'null') {
        console.error('Invalid version number. Please provide a version using --new-version=X.X.X');
        process.exit(1);
    }

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