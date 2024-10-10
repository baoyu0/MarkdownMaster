const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 获取新版本号作为命令行参数
const newVersion = process.argv[2];

if (!newVersion) {
    console.error('请提供新的版本号，例如: npm run release 1.7.3');
    process.exit(1);
}

// 检查版本号格式
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error('版本号格式不正确。请使用 x.y.z 格式，其中 x、y 和 z 都是数字。');
    process.exit(1);
}

try {
    // 更新版本号
    execSync(`node update-version.js ${newVersion}`, { stdio: 'inherit' });

    // 构建项目
    execSync('npm run build', { stdio: 'inherit' });

    // 创建发布目录
    const releaseDir = path.join(__dirname, 'release');
    if (fs.existsSync(releaseDir)) {
        fs.rmdirSync(releaseDir, { recursive: true });
    }
    fs.mkdirSync(releaseDir);

    // 复制必要文件到发布目录
    fs.copyFileSync('main.js', path.join(releaseDir, 'main.js'));
    fs.copyFileSync('manifest.json', path.join(releaseDir, 'manifest.json'));
    if (fs.existsSync('styles.css')) {
        fs.copyFileSync('styles.css', path.join(releaseDir, 'styles.css'));
    }

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