import fs from 'fs';
import { execSync } from 'child_process';

// 读取 package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// 更新版本号（这里假设我们要增加 patch 版本）
const [major, minor, patch] = packageJson.version.split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;

// 更新 package.json
packageJson.version = newVersion;
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

// 更新 manifest.json（如果存在）
try {
  const manifestJson = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  manifestJson.version = newVersion;
  fs.writeFileSync('manifest.json', JSON.stringify(manifestJson, null, 2));
} catch (error) {
  console.log('manifest.json not found or unable to update');
}

// 提交更改
execSync('git add package.json manifest.json');
execSync(`git commit -m "Bump version to ${newVersion}"`);

// 创建新的 tag
execSync(`git tag v${newVersion}`);

console.log(`Version bumped to ${newVersion}`);