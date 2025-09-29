const fs = require('fs');
const path = require('path');

function listRouteFiles(routesDir) {
  return fs
    .readdirSync(routesDir)
    .filter((fileName) => fileName.endsWith('.js'))
    .sort();
}

function extractEndpointsFromFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split(/\r?\n/);
  const endpoints = [];
  const routeRegex = /(router|app)\.(get|post|put|delete|patch)\(['"]([^'\"]+)['"]/i;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(routeRegex);
    if (match) {
      endpoints.push({ method: match[2].toUpperCase(), path: match[3], line: i + 1 });
    }
  }
  return endpoints;
}

function generateApiMarkdown(routesDir, outputFile) {
  const baseMounts = {
    'auth.js': '/api/auth',
    'assessment.js': '/api/assessment',
    'dashboard.js': '/api/dashboard',
    'export.js': '/api/export',
    'pipeline.js': '/api/pipeline',
    'candidates.js': '/api/candidates',
    'ai.routes.js': '/api/v3/ai',
    'email.routes.js': '/api/v3/email',
    'sourcing.js': '/api/sourcing',
    'outreach.js': '/api/sourcing/outreach',
    'analytics.js': '/api/analytics',
  };

  const files = listRouteFiles(routesDir);
  let md = '# API Reference\n\n';
  files.forEach((fileName) => {
    const absolute = path.join(routesDir, fileName);
    const endpoints = extractEndpointsFromFile(absolute);
    const mount = baseMounts[fileName] || 'UNKNOWN';
    md += `## ${fileName} (mounted at ${mount})\n`;
    endpoints.forEach((e) => {
      const base = baseMounts[fileName] || '';
      const full = e.path.startsWith('/') ? e.path : `/${e.path}`;
      md += `- **${e.method}** ${base}${full} (L${e.line})\n`;
    });
    md += '\n';
  });
  fs.writeFileSync(outputFile, md);
}

function main() {
  const routesDir = path.resolve(__dirname, '..', 'backend', 'routes');
  const outputFile = path.resolve(__dirname, '..', 'docs', 'API.md');
  generateApiMarkdown(routesDir, outputFile);
}

main();










