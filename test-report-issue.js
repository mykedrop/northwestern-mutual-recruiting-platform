const { chromium } = require('playwright');

async function testReportIssue() {
    console.log('🔍 Starting Playwright investigation of Candidates Report issue...');

    const browser = await chromium.launch({
        headless: false, // Show browser for debugging
        slowMo: 1000 // Slow down for observation
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
        console.log(`   Stack: ${error.stack}`);
    });

    // Listen for failed requests
    page.on('requestfailed', request => {
        console.log(`🚫 FAILED REQUEST: ${request.method()} ${request.url()}`);
        console.log(`   Failure: ${request.failure()?.errorText}`);
    });

    // Listen for response errors
    page.on('response', response => {
        if (response.status() >= 400) {
            console.log(`⚠️  HTTP ERROR: ${response.status()} ${response.url()}`);
        }
    });

    try {
        console.log('🌐 Navigating to Northwestern Mutual platform...');
        await page.goto('http://localhost:5173/');

        console.log('🔐 Filling in login credentials...');
        await page.fill('input[type="email"]', 'demo@northwestern.com');
        await page.fill('input[type="password"]', 'password123');

        console.log('🚀 Clicking login button...');
        await page.click('button[type="submit"]');

        // Wait for login to complete
        await page.waitForTimeout(2000);

        console.log('📊 Looking for Candidates tab...');
        // Try multiple possible selectors for the Candidates tab
        const candidatesSelectors = [
            'text=Candidates',
            '[data-testid="candidates-tab"]',
            'a[href*="candidates"]',
            'button:has-text("Candidates")',
            '.nav-link:has-text("Candidates")',
            '.tab:has-text("Candidates")'
        ];

        let candidatesFound = false;
        for (const selector of candidatesSelectors) {
            try {
                const element = await page.locator(selector).first();
                if (await element.isVisible()) {
                    console.log(`✅ Found Candidates tab with selector: ${selector}`);
                    await element.click();
                    candidatesFound = true;
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }

        if (!candidatesFound) {
            console.log('❌ Could not find Candidates tab, checking available navigation...');
            const navElements = await page.locator('nav, .nav, .navigation, .sidebar, .menu').all();
            for (const nav of navElements) {
                const text = await nav.textContent();
                console.log(`📋 Nav element text: ${text?.substring(0, 100)}`);
            }

            // Try to find any clickable elements with "candidates" text
            const allElements = await page.locator('*:has-text("Candidates")').all();
            console.log(`🔍 Found ${allElements.length} elements containing "Candidates" text`);

            if (allElements.length > 0) {
                console.log('🎯 Clicking first Candidates element found...');
                await allElements[0].click();
                candidatesFound = true;
            }
        }

        if (candidatesFound) {
            console.log('⏳ Waiting for Candidates page to load...');
            await page.waitForTimeout(2000);

            console.log('🔍 Looking for Report button...');
            // Try multiple possible selectors for the Report button
            const reportSelectors = [
                'text=Report',
                'button:has-text("Report")',
                '[data-testid="report-button"]',
                '.report-button',
                'button[class*="report"]',
                'a:has-text("Report")'
            ];

            let reportFound = false;
            for (const selector of reportSelectors) {
                try {
                    const element = await page.locator(selector).first();
                    if (await element.isVisible()) {
                        console.log(`✅ Found Report button with selector: ${selector}`);

                        console.log('🎯 Clicking Report button and monitoring for errors...');
                        await element.click();

                        // Wait a bit for any errors to appear
                        await page.waitForTimeout(3000);

                        reportFound = true;
                        break;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

            if (!reportFound) {
                console.log('❌ Could not find Report button, listing all buttons on page...');
                const buttons = await page.locator('button, a, [role="button"]').all();
                for (let i = 0; i < Math.min(buttons.length, 10); i++) {
                    const text = await buttons[i].textContent();
                    const classes = await buttons[i].getAttribute('class');
                    console.log(`🔘 Button ${i}: "${text}" (classes: ${classes})`);
                }
            }
        }

        console.log('⏳ Waiting to observe any delayed errors...');
        await page.waitForTimeout(5000);

    } catch (error) {
        console.log(`❌ Test error: ${error.message}`);
        console.log(`   Stack: ${error.stack}`);
    }

    console.log('🔍 Investigation complete. Check console output above for errors.');
    await browser.close();
}

testReportIssue().catch(console.error);