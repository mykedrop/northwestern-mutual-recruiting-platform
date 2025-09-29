import { chromium } from 'playwright';

async function apiDragTest() {
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const page = await browser.newPage();

    let apiCalled = false;
    let apiResponse = null;

    page.on('request', request => {
        if (request.url().includes('/api/pipeline/move')) {
            apiCalled = true;
            console.log('📡 API Request:', request.method(), request.url());
            console.log('📄 Body:', request.postData());
        }
    });

    page.on('response', async response => {
        if (response.url().includes('/api/pipeline/move')) {
            const status = response.status();
            try {
                const body = await response.json();
                apiResponse = { status, body };
                console.log('📨 API Response:', status);
                console.log('📄 Body:', JSON.stringify(body, null, 2));
            } catch (e) {
                console.log('📨 API Response:', status, 'No JSON body');
            }
        }
    });

    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('🎯') || text.includes('📋') || text.includes('🚀') || text.includes('✅') || text.includes('❌')) {
            console.log('🖥️ ', text);
        }
    });

    console.log('🔐 Logging in...');
    await page.goto('http://localhost:5174');
    await page.fill('input[type="email"]', 'demo@northwestern.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    console.log('📋 Going to pipeline...');
    await page.goto('http://localhost:5174/pipeline');
    await page.waitForTimeout(3000);

    const cards = await page.$$('.kanban-card');
    const stages = await page.$$('.pipeline-stage');

    if (cards.length > 0 && stages.length >= 2) {
        const sourceCard = cards[0];
        const targetStage = stages[1];

        const sourceBounds = await sourceCard.boundingBox();
        const targetBounds = await targetStage.boundingBox();

        if (sourceBounds && targetBounds) {
            console.log('\\n🖱️ Performing drag and drop...');

            await page.mouse.move(
                sourceBounds.x + sourceBounds.width / 2,
                sourceBounds.y + sourceBounds.height / 2
            );
            await page.mouse.down();
            await page.waitForTimeout(300);

            await page.mouse.move(
                targetBounds.x + targetBounds.width / 2,
                targetBounds.y + targetBounds.height / 2,
                { steps: 10 }
            );
            await page.waitForTimeout(300);

            await page.mouse.up();
            await page.waitForTimeout(3000);

            console.log('\\n📊 Results:');
            console.log('API Called:', apiCalled);
            if (apiResponse) {
                console.log('API Response Status:', apiResponse.status);
                console.log('API Response Body:', apiResponse.body);
            }

            const toastMessage = await page.$('.toast, .notification, .success-message, [data-sonner-toast]');
            console.log('Toast/Notification shown:', !!toastMessage);

            if (toastMessage) {
                const toastText = await toastMessage.textContent();
                console.log('Toast text:', toastText);
            }
        }
    }

    console.log('\\n⏳ Keeping browser open for 30 seconds...');
    await page.waitForTimeout(30000);
    await browser.close();
}

apiDragTest().catch(console.error);