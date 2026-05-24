const fs = require('fs');
const path = require('path');

const convexUrl = process.env.CONVEX_URL;

if (!convexUrl) {
  console.error('Error: CONVEX_URL environment variable is not set.');
  process.exit(1);
}

const configContent = `const CONVEX_URL = "${convexUrl}";\n`;
const configPath = path.join(__dirname, 'config.js');

fs.writeFileSync(configPath, configContent);
console.log('Successfully generated config.js');
