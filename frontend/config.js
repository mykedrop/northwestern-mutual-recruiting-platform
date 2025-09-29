
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
