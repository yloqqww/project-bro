const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Running prepare-prisma script...');

const candidates = [
  path.resolve(__dirname, '..', '..', 'packages', 'db', 'prisma', 'schema.prisma'),
  path.resolve(__dirname, '..', 'packages', 'db', 'prisma', 'schema.prisma'),
  path.resolve(process.cwd(), '..', 'packages', 'db', 'prisma', 'schema.prisma'),
  path.resolve(process.cwd(), 'packages', 'db', 'prisma', 'schema.prisma')
];

const schemaPath = candidates.find(c => fs.existsSync(c));

if (schemaPath) {
  try {
    console.log('Found Prisma schema at:', schemaPath);
    execSync('npx prisma generate --schema=' + JSON.stringify(schemaPath), { stdio: 'inherit' });
  } catch (e) {
    console.warn('Prisma generate warning:', e.message);
  }
} else {
  console.log('Using pre-generated Prisma client.');
}

const destDir = path.resolve(__dirname, '..', 'generated', 'client-queue');
const srcCandidates = [
  path.resolve(__dirname, '..', '..', 'packages', 'db', 'generated', 'client-queue'),
  path.resolve(__dirname, '..', 'node_modules', '@clinic', 'db', 'generated', 'client-queue')
];

const srcDir = srcCandidates.find(d => fs.existsSync(d));

if (srcDir && srcDir !== destDir) {
  try {
    fs.mkdirSync(destDir, { recursive: true });
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
      if (file.includes('query_engine') || file.endsWith('.node')) {
        const srcFile = path.join(srcDir, file);
        const destFile = path.join(destDir, file);
        fs.copyFileSync(srcFile, destFile);
        console.log('Copied ' + file + ' to apps/web/generated/client-queue');
      }
    }
  } catch (e) {
    console.warn('Copy binary engine error:', e.message);
  }
}

console.log('prepare-prisma completed successfully.');