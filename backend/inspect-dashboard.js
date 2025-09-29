const puppeteer = require('puppeteer');

async function inspectDashboard() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1920, height: 1080 }
    });

    try {
        // Inspect static dashboard
        console.log('🔍 Inspecting Static Dashboard at http://localhost:3001');
        const page1 = await browser.newPage();
        await page1.goto('http://localhost:3001', { waitUntil: 'networkidle0' });

        // Wait for login and login with demo credentials
        try {
            await page1.waitForSelector('#login-email', { timeout: 5000 });
            await page1.type('#login-email', 'demo@northwestern.com');
            await page1.type('#login-password', 'password123');
            await page1.click('#login-btn');
            await page1.waitForNavigation({ waitUntil: 'networkidle0' });
        } catch (e) {
            console.log('Already logged in or login not required');
        }

        // Check if pipeline tab exists and click it
        console.log('📊 Testing Pipeline Tab...');
        await page1.waitForSelector('[data-view="pipeline"]', { timeout: 5000 });
        await page1.click('[data-view="pipeline"]');
        await page1.waitForTimeout(1000);

        // Check what's in the pipeline view
        const pipelineContent = await page1.evaluate(() => {
            const pipelineView = document.getElementById('pipeline-view');
            return {
                isVisible: pipelineView && pipelineView.style.display !== 'none',
                innerHTML: pipelineView ? pipelineView.innerHTML.substring(0, 500) : 'NOT FOUND',
                hasKanbanColumns: document.querySelectorAll('.pipeline-column').length,
                hasCards: document.querySelectorAll('.pipeline-card').length
            };
        });

        console.log('Pipeline Content:', pipelineContent);

        // Test sourcing tab
        console.log('🎯 Testing Sourcing Tab...');
        await page1.click('[data-view="sourcing"]');
        await page1.waitForTimeout(1000);

        const sourcingContent = await page1.evaluate(() => {
            const buttons = {};
            ['find-career-changers-btn', 'target-competitors-btn', 'bulk-message-btn', 'export-results-btn'].forEach(id => {
                const btn = document.getElementById(id);
                buttons[id] = {
                    exists: !!btn,
                    visible: btn ? btn.offsetParent !== null : false,
                    text: btn ? btn.textContent.trim() : 'NOT FOUND'
                };
            });
            return buttons;
        });

        console.log('Sourcing Buttons:', sourcingContent);

        // Check AI Dashboard
        console.log('🤖 Testing AI Dashboard...');
        await page1.click('[data-view="ai-dashboard"]');
        await page1.waitForTimeout(1000);

        const aiDashboardContent = await page1.evaluate(() => {
            const aiView = document.getElementById('ai-dashboard-view');
            return {
                isVisible: aiView && aiView.style.display !== 'none',
                hasContent: aiView ? aiView.innerHTML.includes('AI Candidate Intelligence') : false,
                innerHTML: aiView ? aiView.innerHTML.substring(0, 300) : 'NOT FOUND'
            };
        });

        console.log('AI Dashboard Content:', aiDashboardContent);

        // Take screenshot of static dashboard
        await page1.screenshot({ path: './static-dashboard-debug.png', fullPage: true });

        // Now inspect React dashboard
        console.log('⚛️ Inspecting React Dashboard at http://localhost:5173');
        const page2 = await browser.newPage();
        await page2.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

        // Check for errors
        const reactErrors = await page2.evaluate(() => {
            const errors = window.console ? window.console.errors || [] : [];
            return {
                hasErrors: errors.length > 0,
                errors: errors,
                reactRoot: !!document.getElementById('root'),
                bodyContent: document.body.innerHTML.substring(0, 500)
            };
        });

        console.log('React Dashboard Status:', reactErrors);

        // Take screenshot of React dashboard
        await page2.screenshot({ path: './react-dashboard-debug.png', fullPage: true });

        console.log('✅ Inspection complete. Screenshots saved.');

    } catch (error) {
        console.error('❌ Error during inspection:', error);
    } finally {
        await browser.close();
    }
}

inspectDashboard();