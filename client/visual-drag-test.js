import { chromium } from 'playwright';

async function visualDragTest() {
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

    const stages = await page.$$('.pipeline-stage');
    console.log(`Found ${stages.length} stages`);

    async function getStageCardCounts() {
        const counts = [];
        for (const stage of stages) {
            const cards = await stage.$$('.kanban-card');
            const stageName = await stage.$eval('h3', el => el.textContent);
            counts.push({ name: stageName, count: cards.length });
        }
        return counts;
    }

    console.log('\\n📊 BEFORE DRAG:');
    const beforeCounts = await getStageCardCounts();
    beforeCounts.forEach(s => console.log(`  ${s.name}: ${s.count} cards`));

    const cards = await page.$$('.kanban-card');
    if (cards.length > 0 && stages.length >= 2) {
        const sourceCard = cards[0];
        const candidateName = await sourceCard.$eval('.font-medium', el => el.textContent);
        const targetStage = stages[1];
        const targetStageName = await targetStage.$eval('h3', el => el.textContent);

        console.log(`\\n🎯 Dragging "${candidateName}" to "${targetStageName}"`);

        const sourceBounds = await sourceCard.boundingBox();
        const targetBounds = await targetStage.boundingBox();

        if (sourceBounds && targetBounds) {
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
            console.log('✅ Drag completed');

            await page.waitForTimeout(2000);

            console.log('\\n📊 AFTER DRAG:');
            const afterCounts = await getStageCardCounts();
            afterCounts.forEach(s => console.log(`  ${s.name}: ${s.count} cards`));

            console.log('\\n🔍 ANALYSIS:');
            for (let i = 0; i < beforeCounts.length; i++) {
                const before = beforeCounts[i].count;
                const after = afterCounts[i].count;
                if (before !== after) {
                    console.log(`  ✅ ${beforeCounts[i].name}: ${before} → ${after} (CHANGED!)`);
                } else {
                    console.log(`  ⚪ ${beforeCounts[i].name}: ${before} (no change)`);
                }
            }
        }
    }

    console.log('\\n⏳ Browser staying open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);
    await browser.close();
}

visualDragTest().catch(console.error);