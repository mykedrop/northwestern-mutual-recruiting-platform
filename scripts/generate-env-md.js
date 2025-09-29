const fs = require('fs');
const path = require('path');

function collectEnvKeys(startDirs) {
  const results = new Set();
  const allowedExts = new Set(['.js', '.ts', '.tsx', '.jsx']);

  function walk(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', 'build', '.git'].includes(entry.name)) continue;
        walk(fullPath);
      } else {
        if (!allowedExts.has(path.extname(entry.name))) continue;
        const source = fs.readFileSync(fullPath, 'utf8');
        for (const match of source.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
          results.add(match[1]);
        }
        for (const match of source.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) {
          results.add(match[1]);
        }
      }
    }
  }

  for (const d of startDirs) {
    if (fs.existsSync(d)) {
      walk(d);
    }
  }
  return Array.from(results).sort();
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const startDirs = [
    path.join(repoRoot, 'backend'),
    path.join(repoRoot, 'server'),
    path.join(repoRoot, 'client', 'src'),
  ];
  const keys = collectEnvKeys(startDirs);
  const outPath = path.join(repoRoot, 'docs', 'ENV_VARS.md');
  const md = ['# Environment Variables', '', ...keys.map((k) => `- ${k}`), ''].join('\n');
  fs.writeFileSync(outPath, md);
}

main();










