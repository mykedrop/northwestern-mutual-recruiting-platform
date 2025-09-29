import { chromium } from 'playwright';

async function quickDragTest() {
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const page = await browser.newPage();

    console.log('🔐 Logging in...');
    await page.goto('http://localhost:5174');
    await page.fill('input[type="email"]', 'demo@northwestern.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    console.log('📋 Going to pipeline...');
    await page.goto('http://localhost:5174/pipeline');
    await page.waitForTimeout(3000);

    const dragDropContext = await page.$('[data-rbd-droppable-context-id]');
    console.log('🎯 DragDropContext exists:', !!dragDropContext);

    const cards = await page.$$('.kanban-card');
    console.log(`📋 Found ${cards.length} cards`);

    if (cards.length > 0) {
        const stages = await page.$$('.pipeline-stage');
        if (stages.length >= 2) {
            const sourceCard = cards[0];
            const targetStage = stages[1];

            const sourceBounds = await sourceCard.boundingBox();
            const targetBounds = await targetStage.boundingBox();

            if (sourceBounds && targetBounds) {
                console.log('🖱️ Attempting drag and drop...');

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
                await page.waitForTimeout(2000);

                const dragEndCalled = await page.evaluate(() => window.__dragEndCalled || false);
                console.log('🎯 handleDragEnd called:', dragEndCalled);
            }
        }
    }

    console.log('\\nKeeping browser open for 30 seconds...');
    await page.waitForTimeout(30000);
    await browser.close();
}

quickDragTest().catch(console.error);