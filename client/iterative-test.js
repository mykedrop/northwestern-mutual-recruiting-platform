import { chromium } from 'playwright';

class IterativePlatformTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'http://localhost:5174';
        this.fixes = [];
    }

    async init() {
        this.browser = await chromium.launch({
            headless: false,
            slowMo: 200
        });
        this.page = await this.browser.newPage();
        await this.page.setViewportSize({ width: 1920, height: 1080 });
    }

    log(message) {
        console.log(`🔧 ${message}`);
        this.fixes.push(message);
    }

    async login() {
        console.log('🔐 Logging in...');
        await this.page.goto(this.baseUrl);

        try {
            await this.page.fill('input[type="email"]', 'demo@northwestern.com');
            await this.page.fill('input[type="password"]', 'password123');
            await this.page.click('button[type="submit"]');
            await this.page.waitForTimeout(3000);

            const currentUrl = this.page.url();
            if (!currentUrl.includes('dashboard') && currentUrl === this.baseUrl) {
                throw new Error('Login failed - no navigation occurred');
            }
            console.log('✅ Login successful');
            return true;
        } catch (error) {
            console.log(`❌ Login failed: ${error.message}`);
            return false;
        }
    }

    async testAndFixDashboard() {
        console.log('📊 Testing and fixing Dashboard...');

        // Check for dashboard content
        const dashboardContent = await this.page.$('[data-testid="dashboard-content"], .dashboard, #dashboard');
        if (!dashboardContent) {
            this.log('Missing dashboard content wrapper - need to add data-testid or class');

            // Check what's actually on the page
            const body = await this.page.textContent('body');
            console.log('Current page content preview:', body.substring(0, 200) + '...');

            // Look for existing content that could be the dashboard
            const mainContent = await this.page.$('main, .main-content, .dashboard-wrapper, .content');
            if (mainContent) {
                this.log('Found main content area but missing proper dashboard identifier');
            }
        } else {
            console.log('✅ Dashboard content area found');
        }

        // Check for metrics/stats cards
        const metricsCards = await this.page.$$('.metric-card, .dashboard-card, .stat-card, .card');
        if (metricsCards.length === 0) {
            this.log('Missing dashboard metrics cards - need to add dashboard statistics');
        } else {
            console.log(`✅ Found ${metricsCards.length} dashboard cards`);
        }
    }

    async testAndFixPipeline() {
        console.log('🔄 Testing and fixing Pipeline...');

        // Navigate to pipeline
        await this.navigateToTab('Pipeline', ['pipeline', 'Pipeline']);

        // Check for kanban board
        const kanbanBoard = await this.page.$('.kanban-board, [data-testid="kanban-board"]');
        if (!kanbanBoard) {
            this.log('Kanban board element not found - checking if pipeline loaded');

            // Check what's on the pipeline page
            const pageText = await this.page.textContent('body');
            if (pageText.includes('Pipeline')) {
                this.log('Pipeline page loaded but missing kanban-board class/test-id');
            }
        } else {
            console.log('✅ Kanban board found');
        }

        // Check for pipeline stages
        const stages = await this.page.$$('.pipeline-stage, .kanban-column, .stage-column');
        if (stages.length === 0) {
            this.log('No pipeline stages found - checking if data is loading');

            // Wait a bit more for data to load
            await this.page.waitForTimeout(2000);
            const stagesAfterWait = await this.page.$$('.pipeline-stage, .kanban-column, .stage-column');
            if (stagesAfterWait.length === 0) {
                this.log('Pipeline stages still not found after wait - data loading issue');
            } else {
                console.log(`✅ Found ${stagesAfterWait.length} stages after waiting`);
            }
        } else {
            console.log(`✅ Found ${stages.length} pipeline stages`);
        }

        // Check for candidate cards
        const cards = await this.page.$$('.kanban-card, .candidate-card, .pipeline-card');
        if (cards.length === 0) {
            this.log('No candidate cards found - may need to populate test data');
        } else {
            console.log(`✅ Found ${cards.length} candidate cards`);

            // Test drag and drop if cards exist
            if (cards.length >= 2 && stages.length >= 2) {
                await this.testDragAndDrop(cards[0], stages[1]);
            }
        }
    }

    async testDragAndDrop(sourceCard, targetStage) {
        try {
            console.log('🎯 Testing drag and drop...');

            await sourceCard.hover();
            await this.page.mouse.down();
            await targetStage.hover();
            await this.page.mouse.up();

            // Check for success feedback
            await this.page.waitForTimeout(1000);
            const successMessage = await this.page.$('.success, .toast, .notification');
            if (successMessage) {
                console.log('✅ Drag and drop success feedback found');
            } else {
                this.log('No success feedback for drag and drop - need to add user feedback');
            }
        } catch (error) {
            this.log(`Drag and drop test failed: ${error.message}`);
        }
    }

    async testAndFixCandidates() {
        console.log('👥 Testing and fixing Candidates...');

        await this.navigateToTab('Candidates', ['candidates', 'Candidates']);

        // Check for candidates list
        const candidatesList = await this.page.$('.candidate-list, .candidates-table, table');
        if (!candidatesList) {
            this.log('Missing candidates list/table - need to add proper table structure');

            // Check if there's any tabular data
            const tables = await this.page.$$('table, .table, .data-table');
            if (tables.length === 0) {
                this.log('No table elements found - need to implement candidates table');
            }
        } else {
            console.log('✅ Candidates list found');
        }

        // Check for add candidate button
        const addButton = await this.page.$('[data-testid="add-candidate"], .add-candidate');
        if (!addButton) {
            // Try to find any button that might be the add button
            const buttons = await this.page.$$('button');
            let foundAddButton = false;
            for (const button of buttons) {
                const text = await button.textContent();
                if (text && (text.includes('Add') || text.includes('New') || text.includes('Create'))) {
                    this.log(`Found potential add button: "${text}" - need to add data-testid="add-candidate"`);
                    foundAddButton = true;
                    break;
                }
            }
            if (!foundAddButton) {
                this.log('No add candidate button found - need to implement');
            }
        } else {
            console.log('✅ Add candidate button found');
        }
    }

    async testAndFixAssessments() {
        console.log('📝 Testing and fixing Assessments...');

        await this.navigateToTab('Assessments', ['assessments', 'Assessments']);

        // Check for assessments table
        const assessmentsList = await this.page.$('.assessments-list, .assessments-table, table');
        if (!assessmentsList) {
            this.log('Missing assessments list - need to implement assessments table');
        } else {
            console.log('✅ Assessments list found');
        }

        // Check for create assessment button
        const createButton = await this.page.$('[data-testid="create-assessment"], .create-assessment');
        if (!createButton) {
            this.log('Missing create assessment button - need to add');
        } else {
            console.log('✅ Create assessment button found');
        }
    }

    async testAndFixSourcing() {
        console.log('🔍 Testing and fixing Sourcing...');

        await this.navigateToTab('Sourcing', ['sourcing', 'Sourcing']);

        // Check for search input
        const searchInput = await this.page.$('input[type="search"], .search-input, [data-testid="search-input"]');
        if (!searchInput) {
            // Look for any input that might be search
            const inputs = await this.page.$$('input[type="text"], input:not([type])');
            if (inputs.length > 0) {
                this.log('Found text inputs but need to add proper search input with type="search"');
            } else {
                this.log('No search input found - need to implement search functionality');
            }
        } else {
            console.log('✅ Search input found');
        }

        // Check for search button
        const searchButton = await this.page.$('[data-testid="search-button"], .search-button');
        if (!searchButton) {
            this.log('Missing search button with proper data-testid');
        } else {
            console.log('✅ Search button found');
        }

        // Check for filters
        const filters = await this.page.$('.filters, .search-filters, [data-testid="filters"]');
        if (!filters) {
            this.log('Missing search filters section');
        } else {
            console.log('✅ Search filters found');
        }
    }

    async navigateToTab(tabName, searchTerms) {
        try {
            // First try direct navigation links
            for (const term of searchTerms) {
                const link = await this.page.$(`a[href*="${term.toLowerCase()}"]`);
                if (link) {
                    await link.click();
                    await this.page.waitForTimeout(2000);
                    console.log(`✅ Navigated to ${tabName} via link`);
                    return true;
                }
            }

            // Try to find buttons with text
            const buttons = await this.page.$$('button, .nav-item, .tab');
            for (const button of buttons) {
                const text = await button.textContent();
                if (text && searchTerms.some(term => text.includes(term))) {
                    await button.click();
                    await this.page.waitForTimeout(2000);
                    console.log(`✅ Navigated to ${tabName} via button`);
                    return true;
                }
            }

            this.log(`Could not navigate to ${tabName} - need to fix navigation`);
            return false;
        } catch (error) {
            this.log(`Navigation to ${tabName} failed: ${error.message}`);
            return false;
        }
    }

    async runIterativeTest() {
        console.log('🚀 Starting Iterative Platform Test and Fix...');

        try {
            await this.init();

            const loginSuccess = await this.login();
            if (!loginSuccess) {
                console.log('❌ Cannot continue without login');
                return;
            }

            await this.testAndFixDashboard();
            await this.testAndFixPipeline();
            await this.testAndFixCandidates();
            await this.testAndFixAssessments();
            await this.testAndFixSourcing();

            console.log('\n📋 FIXES NEEDED:');
            this.fixes.forEach((fix, index) => {
                console.log(`${index + 1}. ${fix}`);
            });

        } catch (error) {
            console.error('Test execution error:', error);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

const tester = new IterativePlatformTester();
tester.runIterativeTest().catch(console.error);