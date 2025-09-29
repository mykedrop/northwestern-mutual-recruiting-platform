import { chromium } from 'playwright';

class DragDropDebugger {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'http://localhost:5174';
    }

    async init() {
        console.log('🚀 Initializing Drag & Drop Debugger...');
        this.browser = await chromium.launch({
            headless: false,
            slowMo: 1000
        });
        this.page = await this.browser.newPage();
        await this.page.setViewportSize({ width: 1920, height: 1080 });

        // Monitor all network requests
        this.page.on('request', request => {
            if (request.url().includes('/api/pipeline/move')) {
                console.log('🔗 API Request detected:', request.method(), request.url());
                console.log('📄 Request body:', request.postData());
            }
        });

        this.page.on('response', response => {
            if (response.url().includes('/api/pipeline/move')) {
                console.log('📨 API Response:', response.status(), response.url());
            }
        });

        // Monitor console logs
        this.page.on('console', msg => {
            if (msg.text().includes('🎯') || msg.text().includes('📋') || msg.text().includes('❌') || msg.text().includes('✅') || msg.text().includes('🚀')) {
                console.log('🖥️ Browser Console:', msg.text());
            }
        });

        // Monitor JavaScript errors
        this.page.on('pageerror', error => {
            console.log('❌ JavaScript Error:', error.message);
        });
    }

    async login() {
        console.log('\n🔐 Logging in...');
        await this.page.goto(this.baseUrl);
        await this.page.waitForTimeout(2000);

        await this.page.fill('input[type="email"]', 'demo@northwestern.com');
        await this.page.fill('input[type="password"]', 'password123');
        await this.page.click('button[type="submit"]');
        await this.page.waitForTimeout(3000);
        console.log('✅ Logged in successfully');
    }

    async testDragDrop() {
        console.log('\n🔄 Testing Drag & Drop on Pipeline...');

        // Navigate to pipeline
        await this.page.goto(`${this.baseUrl}/pipeline`);
        await this.page.waitForTimeout(5000);

        // Check if DragDropContext exists
        const dragDropContext = await this.page.$('[data-rbd-droppable-context]');
        console.log('🎯 DragDropContext exists:', !!dragDropContext);

        // Get all stages and cards
        const stages = await this.page.$$('.pipeline-stage');
        const cards = await this.page.$$('.kanban-card');

        console.log(`📋 Found ${stages.length} stages and ${cards.length} cards`);

        if (cards.length === 0) {
            console.log('❌ No cards found - cannot test drag and drop');
            return;
        }

        if (stages.length < 2) {
            console.log('❌ Need at least 2 stages to test drag and drop');
            return;
        }

        // Get the first card and a different stage
        const sourceCard = cards[0];
        const targetStage = stages[1];

        // Get detailed info about the card
        const cardInfo = await this.page.evaluate(card => {
            return {
                draggableId: card.getAttribute('data-rbd-draggable-id'),
                candidateId: card.getAttribute('data-candidate-id'),
                textContent: card.textContent.substring(0, 50)
            };
        }, sourceCard);

        const stageInfo = await this.page.evaluate(stage => {
            const droppable = stage.querySelector('[data-rbd-droppable-id]');
            return {
                droppableId: droppable ? droppable.getAttribute('data-rbd-droppable-id') : null,
                stageName: stage.querySelector('h3') ? stage.querySelector('h3').textContent : 'Unknown'
            };
        }, targetStage);

        console.log('📋 Source Card Info:', cardInfo);
        console.log('🎯 Target Stage Info:', stageInfo);

        // Test 1: Try programmatic drag and drop using react-beautiful-dnd events
        console.log('\n🧪 Test 1: Programmatic drag and drop...');

        try {
            await this.page.evaluate((card, stage) => {
                // Simulate react-beautiful-dnd drag start
                const dragStartEvent = new Event('dragstart', { bubbles: true });
                card.dispatchEvent(dragStartEvent);

                // Find the droppable area
                const droppable = stage.querySelector('[data-rbd-droppable-id]');
                if (droppable) {
                    const dragOverEvent = new Event('dragover', { bubbles: true });
                    droppable.dispatchEvent(dragOverEvent);

                    const dropEvent = new Event('drop', { bubbles: true });
                    droppable.dispatchEvent(dropEvent);
                }

                const dragEndEvent = new Event('dragend', { bubbles: true });
                card.dispatchEvent(dragEndEvent);
            }, sourceCard, targetStage);

            await this.page.waitForTimeout(3000);
        } catch (error) {
            console.log('❌ Programmatic drag failed:', error.message);
        }

        // Test 2: Manual mouse simulation
        console.log('\n🧪 Test 2: Manual mouse simulation...');

        try {
            const sourceBounds = await sourceCard.boundingBox();
            const targetBounds = await targetStage.boundingBox();

            if (sourceBounds && targetBounds) {
                console.log('🖱️ Starting mouse drag simulation...');

                // Move to source
                await this.page.mouse.move(
                    sourceBounds.x + sourceBounds.width / 2,
                    sourceBounds.y + sourceBounds.height / 2
                );
                await this.page.waitForTimeout(500);

                // Mouse down
                await this.page.mouse.down();
                await this.page.waitForTimeout(500);
                console.log('🖱️ Mouse down on source card');

                // Drag to target with multiple intermediate points
                const steps = 10;
                for (let i = 1; i <= steps; i++) {
                    const x = sourceBounds.x + sourceBounds.width / 2 +
                              (targetBounds.x + targetBounds.width / 2 - sourceBounds.x - sourceBounds.width / 2) * (i / steps);
                    const y = sourceBounds.y + sourceBounds.height / 2 +
                              (targetBounds.y + targetBounds.height / 2 - sourceBounds.y - sourceBounds.height / 2) * (i / steps);

                    await this.page.mouse.move(x, y);
                    await this.page.waitForTimeout(100);
                }

                console.log('🖱️ Dragged to target location');
                await this.page.waitForTimeout(1000);

                // Mouse up
                await this.page.mouse.up();
                console.log('🖱️ Mouse up - drop completed');

                await this.page.waitForTimeout(3000);
            }
        } catch (error) {
            console.log('❌ Manual mouse drag failed:', error.message);
        }

        // Test 3: Check if handleDragEnd was called
        console.log('\n🧪 Test 3: Checking for handleDragEnd execution...');

        const dragEndCalled = await this.page.evaluate(() => {
            return window.__dragEndCalled || false;
        });

        console.log('🎯 handleDragEnd called:', dragEndCalled);

        // Test 4: Try clicking directly on the react-beautiful-dnd elements
        console.log('\n🧪 Test 4: Direct interaction with drag handles...');

        try {
            const dragHandle = await sourceCard.$('[data-rbd-drag-handle-draggable-id]');
            if (dragHandle) {
                console.log('✅ Found drag handle');
                await dragHandle.click();
                await this.page.waitForTimeout(1000);
            } else {
                console.log('❌ No drag handle found');
            }
        } catch (error) {
            console.log('❌ Drag handle interaction failed:', error.message);
        }

        // Final check: Look for any success messages
        await this.page.waitForTimeout(2000);
        const successMessage = await this.page.$('.success-message, .toast-success, .notification-success');
        if (successMessage) {
            console.log('✅ Success message found after drag attempt');
        } else {
            console.log('❌ No success message found');
        }
    }

    async runTest() {
        try {
            await this.init();
            await this.login();
            await this.testDragDrop();

            console.log('\n🎯 DRAG & DROP TEST COMPLETE');
            console.log('Check the browser window to see if any cards moved between columns');

        } catch (error) {
            console.error('❌ Test failed:', error);
        } finally {
            // Keep browser open for manual inspection
            console.log('\n⏳ Browser staying open for manual inspection...');
            console.log('Press Ctrl+C to close when done');
            await new Promise(() => {}); // Keep running
        }
    }
}

const test = new DragDropDebugger();
test.runTest().catch(console.error);