const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 获取新版本号作为命令行参数
const newVersion = process.argv[2];

if (!newVersion) {
    console.error('请提供新的版本号，例如: npm run release 1.2.4');
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

    // 运行版本更新脚本
    execSync(`node update-version.js ${newVersion}`, { stdio: 'inherit' });

    // 构建项目
    execSync('npm run build', { stdio: 'inherit' });

    // Git 操作
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "Bump version to ${newVersion}"`, { stdio: 'inherit' });
    execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
    execSync('git push && git push --tags', { stdio: 'inherit' });

    console.log(`版本 ${newVersion} 已成功发布！`);
} catch (error) {
    console.error('发布过程中出错：', error.message);
    process.exit(1);
}