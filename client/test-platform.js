import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';

class PlatformTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'http://localhost:5174';
        this.issues = [];
        this.testResults = {
            passed: 0,
            failed: 0,
            details: []
        };
    }

    async init() {
        this.browser = await puppeteer.launch({
            headless: false,
            slowMo: 100,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });

        // Listen for console errors
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                this.logIssue(`Console Error: ${msg.text()}`);
            }
        });

        // Listen for page errors
        this.page.on('pageerror', error => {
            this.logIssue(`Page Error: ${error.message}`);
        });

        // Listen for failed requests
        this.page.on('requestfailed', request => {
            this.logIssue(`Failed Request: ${request.url()} - ${request.failure().errorText}`);
        });
    }

    logIssue(issue) {
        console.log(`❌ ISSUE: ${issue}`);
        this.issues.push(issue);
        this.testResults.failed++;
    }

    logSuccess(test) {
        console.log(`✅ PASSED: ${test}`);
        this.testResults.passed++;
        this.testResults.details.push({ test, status: 'passed' });
    }

    async testElement(selector, testName, action = 'exists') {
        try {
            await this.page.waitForSelector(selector, { timeout: 5000 });

            if (action === 'click') {
                await this.page.click(selector);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else if (action === 'type') {
                await this.page.type(selector, 'test');
            }

            this.logSuccess(testName);
            return true;
        } catch (error) {
            this.logIssue(`${testName}: ${error.message}`);
            return false;
        }
    }

    async login() {
        console.log('🔐 Testing Login...');
        await this.page.goto(this.baseUrl);

        // Check if login form exists
        await this.testElement('input[type="email"]', 'Login email field exists');
        await this.testElement('input[type="password"]', 'Login password field exists');
        await this.testElement('button[type="submit"]', 'Login submit button exists');

        // Attempt login
        try {
            await this.page.type('input[type="email"]', 'demo@northwestern.com');
            await this.page.type('input[type="password"]', 'password123');
            await this.page.click('button[type="submit"]');

            // Wait for navigation or error
            await new Promise(resolve => setTimeout(resolve, 3000));

            const currentUrl = this.page.url();
            if (currentUrl.includes('dashboard') || currentUrl !== this.baseUrl) {
                this.logSuccess('Login successful');
                return true;
            } else {
                this.logIssue('Login failed - no navigation occurred');
                return false;
            }
        } catch (error) {
            this.logIssue(`Login error: ${error.message}`);
            return false;
        }
    }

    async testDashboard() {
        console.log('📊 Testing Dashboard...');

        // Test main dashboard elements
        await this.testElement('nav', 'Navigation bar exists');
        await this.testElement('[data-testid="dashboard-content"], .dashboard, #dashboard', 'Dashboard content exists');

        // Test navigation tabs
        const tabs = [
            { selector: 'a[href*="dashboard"], button:contains("Dashboard"), .nav-item:contains("Dashboard")', name: 'Dashboard tab' },
            { selector: 'a[href*="candidates"], button:contains("Candidates"), .nav-item:contains("Candidates")', name: 'Candidates tab' },
            { selector: 'a[href*="pipeline"], button:contains("Pipeline"), .nav-item:contains("Pipeline")', name: 'Pipeline tab' },
            { selector: 'a[href*="assessments"], button:contains("Assessments"), .nav-item:contains("Assessments")', name: 'Assessments tab' },
            { selector: 'a[href*="sourcing"], button:contains("Sourcing"), .nav-item:contains("Sourcing")', name: 'Sourcing tab' }
        ];

        for (const tab of tabs) {
            try {
                const element = await this.page.$(tab.selector);
                if (element) {
                    this.logSuccess(`${tab.name} exists`);
                } else {
                    this.logIssue(`${tab.name} not found`);
                }
            } catch (error) {
                this.logIssue(`${tab.name} error: ${error.message}`);
            }
        }

        // Test dashboard cards/metrics
        await this.testElement('.metric-card, .dashboard-card, .stat-card', 'Dashboard metrics cards exist');

        // Test for pipeline health analytics issue
        const pipelineHealth = await this.page.$('.pipeline-health, [data-testid="pipeline-health"]');
        if (pipelineHealth) {
            const text = await this.page.evaluate(el => el.textContent, pipelineHealth);
            if (text.trim() === '' || text.includes('undefined') || text.includes('NaN')) {
                this.logIssue('Pipeline health analytics section is empty or broken');
            } else {
                this.logSuccess('Pipeline health analytics has content');
            }
        }
    }

    async testCandidates() {
        console.log('👥 Testing Candidates...');

        // Navigate to candidates
        await this.navigateToTab('candidates', 'Candidates');

        // Test candidates list
        await this.testElement('.candidate-list, .candidates-table, table', 'Candidates list/table exists');
        await this.testElement('button:contains("Add"), .add-candidate, [data-testid="add-candidate"]', 'Add candidate button exists');

        // Test candidate interactions
        const candidateRows = await this.page.$$('tr, .candidate-row, .candidate-item');
        if (candidateRows.length > 1) { // More than just header
            this.logSuccess('Candidates data loaded');

            // Test clicking on a candidate
            try {
                await candidateRows[1].click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.logSuccess('Candidate row clickable');
            } catch (error) {
                this.logIssue(`Candidate row click error: ${error.message}`);
            }
        } else {
            this.logIssue('No candidate data found');
        }
    }

    async testPipeline() {
        console.log('🔄 Testing Pipeline...');

        // Navigate to pipeline
        await this.navigateToTab('pipeline', 'Pipeline');

        // Test kanban board
        await this.testElement('.kanban-board, .pipeline-board, [data-testid="kanban-board"]', 'Kanban board exists');

        // Test pipeline stages
        const stages = await this.page.$$('.kanban-column, .pipeline-stage, .stage-column');
        if (stages.length > 0) {
            this.logSuccess(`Found ${stages.length} pipeline stages`);

            // Test drag and drop functionality
            const cards = await this.page.$$('.kanban-card, .candidate-card, .pipeline-card');
            if (cards.length >= 2) {
                try {
                    // Test drag and drop
                    const sourceCard = cards[0];
                    const targetStage = stages[1];

                    const sourceBounds = await sourceCard.boundingBox();
                    const targetBounds = await targetStage.boundingBox();

                    if (sourceBounds && targetBounds) {
                        await this.page.mouse.move(sourceBounds.x + sourceBounds.width / 2, sourceBounds.y + sourceBounds.height / 2);
                        await this.page.mouse.down();
                        await new Promise(resolve => setTimeout(resolve, 100));
                        await this.page.mouse.move(targetBounds.x + targetBounds.width / 2, targetBounds.y + targetBounds.height / 2);
                        await new Promise(resolve => setTimeout(resolve, 100));
                        await this.page.mouse.up();
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        this.logSuccess('Drag and drop executed');

                        // Check for success message or API call
                        const successIndicator = await this.page.$('.success-message, .toast-success, .notification-success');
                        if (successIndicator) {
                            this.logSuccess('Drag and drop success feedback shown');
                        } else {
                            this.logIssue('No success feedback for drag and drop');
                        }
                    }
                } catch (error) {
                    this.logIssue(`Drag and drop test error: ${error.message}`);
                }
            } else {
                this.logIssue('Not enough cards to test drag and drop');
            }
        } else {
            this.logIssue('No pipeline stages found');
        }
    }

    async testAssessments() {
        console.log('📝 Testing Assessments...');

        // Navigate to assessments
        await this.navigateToTab('assessments', 'Assessments');

        // Test assessments list
        await this.testElement('.assessments-list, .assessments-table, table', 'Assessments list/table exists');

        // Test assessment actions
        await this.testElement('button:contains("Create"), .create-assessment, [data-testid="create-assessment"]', 'Create assessment button exists');

        // Test assessment data
        const assessmentRows = await this.page.$$('tr, .assessment-row, .assessment-item');
        if (assessmentRows.length > 1) {
            this.logSuccess('Assessment data loaded');
        } else {
            this.logIssue('No assessment data found');
        }
    }

    async testSourcing() {
        console.log('🔍 Testing Sourcing...');

        // Navigate to sourcing
        await this.navigateToTab('sourcing', 'Sourcing');

        // Test search functionality
        await this.testElement('input[type="search"], .search-input, [data-testid="search-input"]', 'Search input exists');
        await this.testElement('button:contains("Search"), .search-button, [data-testid="search-button"]', 'Search button exists');

        // Test search filters
        await this.testElement('.filters, .search-filters, [data-testid="filters"]', 'Search filters exist');

        // Test performing a search
        try {
            const searchInput = await this.page.$('input[type="search"], .search-input, [data-testid="search-input"]');
            if (searchInput) {
                await searchInput.type('software engineer');
                const searchButton = await this.page.$('button:contains("Search"), .search-button, [data-testid="search-button"]');
                if (searchButton) {
                    await searchButton.click();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    this.logSuccess('Search executed');

                    // Check for results
                    const results = await this.page.$('.search-results, .results-list, [data-testid="search-results"]');
                    if (results) {
                        this.logSuccess('Search results displayed');
                    } else {
                        this.logIssue('No search results displayed');
                    }
                }
            }
        } catch (error) {
            this.logIssue(`Search test error: ${error.message}`);
        }
    }

    async navigateToTab(tabName, displayName) {
        try {
            // Try multiple selector strategies
            const selectors = [
                `a[href*="${tabName}"]`,
                `button:contains("${displayName}")`,
                `.nav-item:contains("${displayName}")`,
                `[data-testid="${tabName}-tab"]`,
                `.${tabName}-tab`
            ];

            let clicked = false;
            for (const selector of selectors) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        await element.click();
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        clicked = true;
                        break;
                    }
                } catch (e) {
                    // Try next selector
                    continue;
                }
            }

            if (clicked) {
                this.logSuccess(`Navigated to ${displayName} tab`);
            } else {
                this.logIssue(`Could not navigate to ${displayName} tab`);
            }
        } catch (error) {
            this.logIssue(`Navigation to ${displayName} error: ${error.message}`);
        }
    }

    async testAllInteractiveElements() {
        console.log('🔘 Testing All Interactive Elements...');

        // Test all buttons
        const buttons = await this.page.$$('button');
        console.log(`Found ${buttons.length} buttons`);

        for (let i = 0; i < Math.min(buttons.length, 20); i++) {
            try {
                const button = buttons[i];
                const text = await this.page.evaluate(el => el.textContent?.trim() || el.getAttribute('aria-label') || 'unnamed', button);
                const isVisible = await button.isIntersectingViewport();
                const isEnabled = await this.page.evaluate(el => !el.disabled, button);

                if (isVisible && isEnabled && text !== 'unnamed') {
                    this.logSuccess(`Button "${text}" is visible and enabled`);
                } else if (!isVisible) {
                    this.logIssue(`Button "${text}" is not visible`);
                } else if (!isEnabled) {
                    this.logIssue(`Button "${text}" is disabled`);
                }
            } catch (error) {
                this.logIssue(`Button test error: ${error.message}`);
            }
        }

        // Test all input fields
        const inputs = await this.page.$$('input, textarea, select');
        console.log(`Found ${inputs.length} input elements`);

        for (let i = 0; i < Math.min(inputs.length, 10); i++) {
            try {
                const input = inputs[i];
                const type = await this.page.evaluate(el => el.type || el.tagName, input);
                const placeholder = await this.page.evaluate(el => el.placeholder || el.getAttribute('aria-label') || 'no placeholder', input);
                const isVisible = await input.isIntersectingViewport();

                if (isVisible) {
                    this.logSuccess(`Input ${type} "${placeholder}" is visible`);
                } else {
                    this.logIssue(`Input ${type} "${placeholder}" is not visible`);
                }
            } catch (error) {
                this.logIssue(`Input test error: ${error.message}`);
            }
        }
    }

    async runFullTest() {
        console.log('🚀 Starting Comprehensive Platform Test...');

        try {
            await this.init();

            // Login first
            const loginSuccess = await this.login();
            if (!loginSuccess) {
                console.log('❌ Login failed, cannot continue with other tests');
                await this.generateReport();
                return;
            }

            // Test each section
            await this.testDashboard();
            await this.testCandidates();
            await this.testPipeline();
            await this.testAssessments();
            await this.testSourcing();
            await this.testAllInteractiveElements();

            await this.generateReport();

        } catch (error) {
            console.error('Test execution error:', error);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.testResults.passed + this.testResults.failed,
                passed: this.testResults.passed,
                failed: this.testResults.failed,
                successRate: Math.round((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100) || 0
            },
            issues: this.issues,
            details: this.testResults.details
        };

        console.log('\n📋 TEST REPORT');
        console.log('==============');
        console.log(`Total Tests: ${report.summary.totalTests}`);
        console.log(`Passed: ${report.summary.passed}`);
        console.log(`Failed: ${report.summary.failed}`);
        console.log(`Success Rate: ${report.summary.successRate}%`);
        console.log('\n❌ ISSUES FOUND:');
        this.issues.forEach((issue, index) => {
            console.log(`${index + 1}. ${issue}`);
        });

        // Save report to file
        await fs.writeFile(
            '/Users/mikeweingarten/Projects/recruiting/test-report.json',
            JSON.stringify(report, null, 2)
        );

        console.log('\n📄 Report saved to test-report.json');

        return report;
    }
}

// Run the test
const tester = new PlatformTester();
tester.runFullTest().catch(console.error);