const fs = require('fs');
const path = require('path');

const exportsDir = path.join(__dirname, '..', 'exports');

if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
    console.log('Created exports directory');
} else {
    console.log('Exports directory already exists');
}
