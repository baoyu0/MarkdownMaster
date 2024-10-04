import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import semver from 'semver'; // 请确保已安装 semver 包
import AdmZip from 'adm-zip';

const updateVersionInFile = (filePath, newVersion) => {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.version = newVersion;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
};

try {
    console.log('Process arguments:', process.argv);

    // 获取当前版本
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const currentVersion = packageJson.version;

    // 如果没有提供新版本，则自动增加补丁版本号
    const newVersion = process.env.npm_config_new_version || semver.inc(currentVersion, 'patch');

    console.log('Current version:', currentVersion);
    console.log('New version:', newVersion);

    if (!semver.valid(newVersion)) {
        console.error('Invalid version number. Please provide a valid semver version.');
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

    // 创建压缩包
    const zip = new AdmZip();
    const outputDir = 'release';
    const zipFilename = `markdown-master-${newVersion}.zip`;

    zip.addLocalFile('main.js');
    zip.addLocalFile('manifest.json');
    zip.addLocalFile('styles.css');
    // 添加其他需要包含在插件中的文件

    if (!fs.existsSync(outputDir)){
        fs.mkdirSync(outputDir);
    }
    zip.writeZip(path.join(outputDir, zipFilename));

    console.log(`Created ${zipFilename}`);

    console.log(`Successfully released version ${newVersion}`);
} catch (error) {
    console.error('Release failed:', error.message);
    process.exit(1);
}