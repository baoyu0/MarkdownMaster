const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 获取新版本号作为命令行参数
const newVersion = process.argv[2];

if (!newVersion) {
    console.error('请提供新的版本号，例如: npm run release 1.2.9');
    process.exit(1);
}

// 检查版本号格式
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error('版本号格式不正确。请使用 x.y.z 格式，其中 x、y 和 z 都是数字。');
    process.exit(1);
}

try {
    // 检查工作目录是否干净
    const status = execSync('git status --porcelain').toString().trim();
    if (status) {
        console.error('工作目录不干净。请提交或存储您的更改后再运行此脚本。');
        process.exit(1);
    }

    // 更新 package.json
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = require(packageJsonPath);
    if (packageJson.version === newVersion) {
        console.error(`package.json 中的版本号已经是 ${newVersion}`);
        process.exit(1);
    }
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`已更新 package.json 版本号为 ${newVersion}`);

    // 更新 manifest.json
    const manifestJsonPath = path.join(__dirname, 'manifest.json');
    const manifestJson = require(manifestJsonPath);
    manifestJson.version = newVersion;
    fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2));
    console.log(`已更新 manifest.json 版本号为 ${newVersion}`);

    // 更新 versions.json
    const versionsJsonPath = path.join(__dirname, 'versions.json');
    const versionsJson = require(versionsJsonPath);
    versionsJson[newVersion] = manifestJson.minAppVersion;
    fs.writeFileSync(versionsJsonPath, JSON.stringify(versionsJson, null, 2));
    console.log(`已更新 versions.json`);

    // 构建项目
    console.log('开始构建项目...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('项目构建完成');

    // Git 操作
    console.log('执行 Git 操作...');
    execSync('git add .', { stdio: 'inherit' });
    console.log('Git add 完成');
    execSync(`git commit -m "Bump version to ${newVersion}"`, { stdio: 'inherit' });
    console.log('Git commit 完成');
    execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
    console.log('Git tag 完成');
    execSync('git push && git push --tags', { stdio: 'inherit' });
    console.log('Git push 完成');

    console.log(`版本 ${newVersion} 已成功发布！`);
} catch (error) {
    console.error('发布过程中出错：', error.message);
    process.exit(1);
}