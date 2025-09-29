const { chromium } = require('playwright');

async function testReportFix() {
    console.log('🔍 Testing the Report fix...');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Listen for console messages
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        console.log(`📱 CONSOLE [${type.toUpperCase()}]: ${text}`);
    });

    // Listen for page errors
    page.on('pageerror', error => {
        console.log(`❌ PAGE ERROR: ${error.message}`);
    });

    // Listen for failed requests
    page.on('requestfailed', request => {
        console.log(`🚫 FAILED REQUEST: ${request.method()} ${request.url()}`);
    });

    // Listen for response errors
    page.on('response', response => {
        if (response.status() >= 400) {
            console.log(`⚠️  HTTP ERROR: ${response.status()} ${response.url()}`);
        } else if (response.url().includes('/api/assessment/by-candidate/')) {
            console.log(`✅ ASSESSMENT API SUCCESS: ${response.status()} ${response.url()}`);
        }
    });

    try {
        console.log('🌐 Navigating to Northwestern Mutual platform...');
        await page.goto('http://localhost:5173/');

        console.log('🔐 Logging in...');
        await page.fill('input[type="email"]', 'demo@northwestern.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);

        console.log('📊 Navigating to Candidates tab...');
        await page.click('text=Candidates');
        await page.waitForTimeout(2000);

        console.log('🎯 Clicking Report button...');
        await page.click('text=Report');

        console.log('⏳ Waiting for report to load...');
        await page.waitForTimeout(5000);

        // Check if the report loaded without errors
        const reportContent = await page.textContent('body');
        if (reportContent.includes('Failed to fetch') || reportContent.includes('Error')) {
            console.log('❌ Report still showing errors');
        } else {
            console.log('✅ Report appears to be working!');
        }

        console.log('🔍 Checking for any error messages in the UI...');
        const errorElements = await page.locator('text=/error|failed|not found/i').all();
        if (errorElements.length > 0) {
            console.log(`⚠️ Found ${errorElements.length} potential error messages in UI`);
            for (let i = 0; i < errorElements.length; i++) {
                const text = await errorElements[i].textContent();
                console.log(`   - "${text}"`);
            }
        } else {
            console.log('✅ No error messages found in UI');
        }

    } catch (error) {
        console.log(`❌ Test error: ${error.message}`);
    }

    console.log('🏁 Test complete. Check output above for results.');
    await browser.close();
}

testReportFix().catch(console.error);