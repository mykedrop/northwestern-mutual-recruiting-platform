const fs = require('fs');
const path = require('path');

const filesToFix = [
    '../../frontend/login.html',
    '../../frontend/dashboard.js',
    '../../frontend/api-client.js',
    '../../frontend/kanban.js',
    '../../frontend/assets/js/sourcing.js',
    '../../client/src/services/api.ts'
];

const replaceHardcodedUrls = (filePath) => {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) return;

    let content = fs.readFileSync(fullPath, 'utf8');

    // Replace hardcoded URLs with dynamic configuration
    content = content.replace(
        /http:\/\/localhost:\d+/g,
        "window.API_BASE_URL || ''"
    );

    content = content.replace(
        /fetch\(['"]\/api\//g,
        "fetch((window.API_BASE_URL || '') + '/api/"
    );

    fs.writeFileSync(fullPath, content);
    console.log(`Fixed: ${filePath}`);
};

// Create global config file for frontend
const frontendConfig = `
// Global configuration for Northwestern Mutual Recruiting Platform
window.APP_CONFIG = {
    API_BASE_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : window.location.origin,
    WS_URL: window.location.hostname === 'localhost'
        ? 'ws://localhost:3002'
        : window.location.origin.replace('http', 'ws'),
    APP_NAME: 'Northwestern Mutual Recruiting Platform',
    VERSION: '2.0.0',
    FEATURES: {
        enableAI: true,
        enableExport: true,
        enableSourcing: true
    }
};

window.API_BASE_URL = window.APP_CONFIG.API_BASE_URL;
window.WS_URL = window.APP_CONFIG.WS_URL;
`;

fs.writeFileSync(
    path.join(__dirname, '../../frontend/config.js'),
    frontendConfig
);

// Fix all files
filesToFix.forEach(replaceHardcodedUrls);

// Update all HTML files to include config
const htmlFiles = [
    '../../frontend/login.html',
    '../../frontend/dashboard.html',
    '../../frontend/assessment.html',
    '../../frontend/kanban.html'
];

htmlFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) return;

    let content = fs.readFileSync(fullPath, 'utf8');

    // Add config script before other scripts
    if (!content.includes('config.js')) {
        content = content.replace(
            '<script',
            '<script src="/config.js"></script>\n    <script'
        );
        fs.writeFileSync(fullPath, content);
        console.log(`Added config to: ${file}`);
    }
});

console.log('Frontend URL fixes complete!');