import fs from 'fs';
import path from 'path';

function bumpVersion(currentVersion, newVersion) {
  // 简单的版本号替换，可以根据需要进行更复杂的处理
  return newVersion;
}

const newVersion = process.env.npm_config_new_version;

if (!newVersion) {
  console.error('请提供新的版本号，例如: npm run release --new_version=1.2.20');
  process.exit(1);
}

const packageJsonPath = path.resolve('package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

packageJson.version = bumpVersion(packageJson.version, newVersion);

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log(`package.json 的版本已更新为 ${newVersion}`);