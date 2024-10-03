const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '..', 'package.json');
const manifestPath = path.join(__dirname, '..', 'manifest.json');

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (packageJson.version !== manifestJson.version) {
    manifestJson.version = packageJson.version;
    fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2));
    console.log(`Updated manifest.json version to ${packageJson.version}`);
}