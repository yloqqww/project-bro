const fs = require('fs');
const path = require('path');

console.log('Preparing Prisma query engines for Vercel...');

const engineDir = path.resolve(__dirname, '..', 'generated', 'client-queue');
const targets = [
  path.resolve(__dirname, '..', 'node_modules', '.prisma', 'client'),
  path.resolve(__dirname, '..', 'node_modules', '@prisma', 'client'),
  path.resolve(__dirname, '..', '.next', 'server'),
  '/tmp/prisma-engines',
];

if (fs.existsSync(engineDir)) {
  const files = fs.readdirSync(engineDir);
  const engineFiles = files.filter(f => f.includes('query_engine') || f.endsWith('.node'));

  for (const target of targets) {
    try {
      fs.mkdirSync(target, { recursive: true });
      for (const file of engineFiles) {
        fs.copyFileSync(path.join(engineDir, file), path.join(target, file));
      }
      console.log(`Copied query engines to ${target}`);
    } catch (e) {
      // In Windows or restricted dirs, ignore harmless errors
    }
  }
}
console.log('Prisma query engines prepared.');