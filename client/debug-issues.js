import { chromium } from 'playwright';

class CriticalIssueDebugger {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'http://localhost:5174';
    }

    async init() {
        this.browser = await chromium.launch({
            headless: false,
            slowMo: 500
        });
        this.page = await this.browser.newPage();
        await this.page.setViewportSize({ width: 1920, height: 1080 });
    }

    async login() {
        console.log('🔐 Logging in...');
        await this.page.goto(this.baseUrl);
        await this.page.fill('input[type="email"]', 'demo@northwestern.com');
        await this.page.fill('input[type="password"]', 'password123');
        await this.page.click('button[type="submit"]');
        await this.page.waitForTimeout(3000);
        console.log('✅ Login successful');
    }

    async debugDashboard() {
        console.log('📊 Debugging Dashboard Issues...');

        // Navigate to dashboard
        await this.page.goto(`${this.baseUrl}/dashboard`);
        await this.page.waitForTimeout(2000);

        // Check pipeline health analytics
        const pipelineHealth = await this.page.$('.pipeline-health');
        if (pipelineHealth) {
            const content = await this.page.evaluate(el => el.textContent, pipelineHealth);
            console.log('📈 Pipeline Health Content:', content.substring(0, 200));

            // Check if it's empty or has issues
            const stageElements = await this.page.$$('.pipeline-health .text-3xl');
            console.log(`📊 Found ${stageElements.length} stage metrics`);

            for (let i = 0; i < stageElements.length; i++) {
                const value = await this.page.evaluate(el => el.textContent, stageElements[i]);
                console.log(`   Stage ${i + 1}: ${value}`);
            }
        } else {
            console.log('❌ Pipeline health section not found');
        }
    }

    async debugPipeline() {
        console.log('🔄 Debugging Pipeline Issues...');

        // Set up API monitoring and console logging before navigating
        const apiCalls = [];
        const consoleLogs = [];

        this.page.on('response', response => {
            if (response.url().includes('/api/')) {
                apiCalls.push({
                    url: response.url(),
                    status: response.status(),
                    statusText: response.statusText(),
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.page.on('console', msg => {
            if (msg.text().includes('🎯') || msg.text().includes('📋') || msg.text().includes('❌') || msg.text().includes('✅') || msg.text().includes('🚀')) {
                consoleLogs.push({
                    type: msg.type(),
                    text: msg.text(),
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Navigate to pipeline
        await this.page.goto(`${this.baseUrl}/pipeline`);
        await this.page.waitForTimeout(3000);

        // Check for duplicate columns
        const stageColumns = await this.page.$$('.pipeline-stage');
        console.log(`📋 Found ${stageColumns.length} pipeline stage columns`);

        const stageNames = [];
        for (let i = 0; i < stageColumns.length; i++) {
            const stageName = await this.page.evaluate(el => {
                const nameElement = el.querySelector('h3');
                return nameElement ? nameElement.textContent.trim() : 'No name';
            }, stageColumns[i]);
            stageNames.push(stageName);
            console.log(`   Column ${i + 1}: "${stageName}"`);
        }

        // Check for duplicates
        const duplicates = stageNames.filter((name, index) => stageNames.indexOf(name) !== index);
        if (duplicates.length > 0) {
            console.log('🚨 DUPLICATE COLUMNS FOUND:', [...new Set(duplicates)]);
        }

        // Check kanban cards
        const cards = await this.page.$$('.kanban-card');
        console.log(`🎴 Found ${cards.length} kanban cards`);

        // Clear previous API calls
        apiCalls.length = 0;

        // Test drag and drop
        if (cards.length >= 1 && stageColumns.length >= 2) {
            console.log('🎯 Testing drag and drop...');

            const sourceCard = cards[0];
            const targetColumn = stageColumns[1];

            // Get candidate ID and target stage ID
            const candidateId = await this.page.evaluate(card => {
                return card.getAttribute('data-rbd-draggable-id') || card.getAttribute('data-candidate-id') || 'unknown';
            }, sourceCard);

            const targetStageId = await this.page.evaluate(column => {
                const droppable = column.querySelector('[data-rbd-droppable-id]');
                return droppable ? droppable.getAttribute('data-rbd-droppable-id') : 'unknown';
            }, targetColumn);

            console.log(`📋 Moving candidate ${candidateId} to stage ${targetStageId}`);

            // Get initial positions
            const sourceBounds = await sourceCard.boundingBox();
            const targetBounds = await targetColumn.boundingBox();

            if (sourceBounds && targetBounds) {
                console.log('🖱️ Performing drag and drop...');

                // Use mouse events with proper timing for react-beautiful-dnd
                const sourceX = sourceBounds.x + sourceBounds.width / 2;
                const sourceY = sourceBounds.y + sourceBounds.height / 2;
                const targetX = targetBounds.x + targetBounds.width / 2;
                const targetY = targetBounds.y + targetBounds.height / 2;

                // Move to source element
                await this.page.mouse.move(sourceX, sourceY);
                await this.page.waitForTimeout(100);

                // Press mouse down (start drag)
                await this.page.mouse.down();
                await this.page.waitForTimeout(200); // Wait a bit longer for drag to start

                // Move slowly towards target to simulate drag
                const steps = 10;
                for (let i = 1; i <= steps; i++) {
                    const x = sourceX + (targetX - sourceX) * (i / steps);
                    const y = sourceY + (targetY - sourceY) * (i / steps);
                    await this.page.mouse.move(x, y);
                    await this.page.waitForTimeout(50);
                }

                // Wait a moment at target
                await this.page.waitForTimeout(200);

                // Release mouse (end drag)
                await this.page.mouse.up();
                await this.page.waitForTimeout(2000);

                // Check API calls made during drag and drop
                console.log('📞 API calls during drag and drop:');
                apiCalls.forEach(call => {
                    console.log(`   ${call.timestamp} - ${call.status} ${call.url}`);
                });

                // Check for pipeline move API call specifically
                const moveApiCall = apiCalls.find(call => call.url.includes('/pipeline/move'));
                if (moveApiCall) {
                    console.log(`✅ Pipeline move API call found: ${moveApiCall.status} ${moveApiCall.url}`);
                } else {
                    console.log('❌ No pipeline move API call found');
                }

                // Check for success feedback
                await this.page.waitForTimeout(1000);
                const successMessage = await this.page.$('.success-message, .toast-success, .notification-success');
                if (successMessage) {
                    console.log('✅ Success feedback found');
                } else {
                    console.log('❌ No success feedback found');
                }

                // Show captured console logs
                console.log('📝 Console logs during drag and drop:');
                consoleLogs.forEach(log => {
                    console.log(`   [${log.type}] ${log.text}`);
                });

                if (consoleLogs.length === 0) {
                    console.log('❓ No debug console logs captured - handleDragEnd might not be called');
                }
            }
        }
    }

    async debugDataLoading() {
        console.log('📡 Debugging Data Loading...');

        // Check API calls
        const apiCalls = [];
        this.page.on('response', response => {
            if (response.url().includes('/api/')) {
                apiCalls.push({
                    url: response.url(),
                    status: response.status(),
                    statusText: response.statusText()
                });
            }
        });

        await this.page.goto(`${this.baseUrl}/pipeline`);
        await this.page.waitForTimeout(3000);

        console.log('📞 API calls made:');
        apiCalls.forEach(call => {
            console.log(`   ${call.status} ${call.url}`);
        });

        // Check network errors
        this.page.on('requestfailed', request => {
            console.log('❌ Failed request:', request.url(), request.failure().errorText);
        });
    }

    async runDebug() {
        try {
            await this.init();
            await this.login();
            await this.debugDashboard();
            await this.debugPipeline();
            await this.debugDataLoading();

            console.log('\n🎯 CRITICAL ISSUES TO FIX:');
            console.log('1. Duplicate pipeline columns');
            console.log('2. Drag and drop not working');
            console.log('3. Empty pipeline health analytics');
            console.log('4. Check for data loading issues');

        } catch (error) {
            console.error('Debug error:', error);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

const issueDebugger = new CriticalIssueDebugger();
issueDebugger.runDebug().catch(console.error);