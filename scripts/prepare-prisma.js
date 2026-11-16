const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Running prepare-prisma script...');

// 1. Run prisma generate
const schemaPath = path.resolve(__dirname, '..', 'packages', 'db', 'prisma', 'schema.prisma');
try {
  execSync(`npx prisma generate --schema="${schemaPath}"`, { stdio: 'inherit' });
} catch (e) {
  console.warn('Prisma generate warning:', e.message);
}

// 2. Copy query engine binaries to apps/web/generated/client-queue
const srcDir = path.resolve(__dirname, '..', 'packages', 'db', 'generated', 'client-queue');
const destDir = path.resolve(__dirname, '..', 'apps', 'web', 'generated', 'client-queue');

if (fs.existsSync(srcDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    if (file.includes('query_engine') || file.endsWith('.node')) {
      const srcFile = path.join(srcDir, file);
      const destFile = path.join(destDir, file);
      fs.copyFileSync(srcFile, destFile);
      console.log(`Copied ${file} to apps/web/generated/client-queue`);
    }
  }
}

console.log('prepare-prisma completed successfully.');
