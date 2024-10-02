const fs = require('fs');
const path = require('path');

// 获取新版本号作为命令行参数
const newVersion = process.argv[2];

if (!newVersion) {
    console.error('请提供新的版本号，例如: node update-version.js 1.2.3');
    process.exit(1);
}

// 更新 package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = require(packageJsonPath);
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// 更新 manifest.json
const manifestJsonPath = path.join(__dirname, 'manifest.json');
const manifestJson = require(manifestJsonPath);
manifestJson.version = newVersion;
fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2));

// 更新 versions.json
const versionsJsonPath = path.join(__dirname, 'versions.json');
const versionsJson = require(versionsJsonPath);
versionsJson[newVersion] = manifestJson.minAppVersion;
fs.writeFileSync(versionsJsonPath, JSON.stringify(versionsJson, null, 2));

console.log(`版本已更新到 ${newVersion}`);