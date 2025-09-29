import { chromium } from 'playwright';

class FocusedNorthwesternAudit {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'http://localhost:5174';
        this.results = {
            score: 0,
            maxScore: 0,
            modules: {},
            criticalIssues: [],
            successes: []
        };
    }

    async init() {
        console.log('🚀 Starting Focused Northwestern Mutual Platform Audit...');
        this.browser = await chromium.launch({
            headless: false,
            slowMo: 500
        });
        this.page = await this.browser.newPage();
        await this.page.setViewportSize({ width: 1920, height: 1080 });

        // Setup monitoring
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                this.addIssue('console', `Console Error: ${msg.text()}`);
            }
        });
    }

    addIssue(category, issue) {
        this.results.criticalIssues.push(`[${category.toUpperCase()}] ${issue}`);
    }

    addSuccess(category, success) {
        this.results.successes.push(`[${category.toUpperCase()}] ${success}`);
        this.results.score += 1;
    }

    incrementMaxScore() {
        this.results.maxScore += 1;
    }

    async testLogin() {
        console.log('\n🔐 Testing Login...');

        this.incrementMaxScore();
        await this.page.goto(this.baseUrl);
        await this.page.waitForTimeout(2000);

        // Check login form
        const emailField = await this.page.$('input[type="email"]');
        const passwordField = await this.page.$('input[type="password"]');
        const submitButton = await this.page.$('button[type="submit"]');

        if (emailField && passwordField && submitButton) {
            this.addSuccess('login', '✅ Login form elements exist');

            // Perform login
            await this.page.fill('input[type="email"]', 'demo@northwestern.com');
            await this.page.fill('input[type="password"]', 'password123');
            await this.page.click('button[type="submit"]');
            await this.page.waitForTimeout(3000);

            // Check if logged in (look for navigation or user info)
            const navigation = await this.page.$('nav, .nav, .navigation');
            if (navigation) {
                this.addSuccess('login', '✅ Login successful - navigation visible');
                return true;
            } else {
                this.addIssue('login', '❌ Login failed - no navigation found');
                return false;
            }
        } else {
            this.addIssue('login', '❌ Login form elements missing');
            return false;
        }
    }

    async testDashboard() {
        console.log('\n📊 Testing Dashboard...');

        await this.page.goto(`${this.baseUrl}/`);
        await this.page.waitForTimeout(3000);

        // Test dashboard content
        this.incrementMaxScore();
        const content = await this.page.$('.dashboard, main, [data-testid="dashboard-content"]');
        if (content) {
            this.addSuccess('dashboard', '✅ Dashboard content area found');
        } else {
            this.addIssue('dashboard', '❌ Dashboard content area not found');
        }

        // Test metrics
        this.incrementMaxScore();
        const metrics = await this.page.$$('.metric, .card, .dashboard-card, [class*="metric"]');
        if (metrics.length > 0) {
            this.addSuccess('dashboard', `✅ Found ${metrics.length} dashboard metrics`);
        } else {
            this.addIssue('dashboard', '❌ No dashboard metrics found');
        }

        // Test navigation
        this.incrementMaxScore();
        const navItems = await this.page.$$('nav a, .nav a');
        if (navItems.length >= 5) {
            this.addSuccess('dashboard', `✅ Navigation has ${navItems.length} items`);
        } else {
            this.addIssue('dashboard', `❌ Navigation has only ${navItems.length} items`);
        }
    }

    async testCandidates() {
        console.log('\n👥 Testing Candidates...');

        await this.page.goto(`${this.baseUrl}/candidates`);
        await this.page.waitForTimeout(3000);

        this.incrementMaxScore();
        const candidatesTable = await this.page.$('table, .candidates-list, .candidate-list, .candidates-table');
        if (candidatesTable) {
            this.addSuccess('candidates', '✅ Candidates table/list found');
        } else {
            this.addIssue('candidates', '❌ Candidates table/list not found');
        }

        this.incrementMaxScore();
        const candidateRows = await this.page.$$('tr, .candidate-item, .candidate-row, .border.rounded-lg');
        if (candidateRows.length > 0) {
            this.addSuccess('candidates', `✅ Found ${candidateRows.length} candidate entries`);
        } else {
            this.addIssue('candidates', '❌ No candidate data found');
        }
    }

    async testPipeline() {
        console.log('\n🔄 Testing Pipeline...');

        await this.page.goto(`${this.baseUrl}/pipeline`);
        await this.page.waitForTimeout(3000);

        this.incrementMaxScore();
        const kanbanBoard = await this.page.$('.kanban-board, [data-testid="kanban-board"]');
        if (kanbanBoard) {
            this.addSuccess('pipeline', '✅ Kanban board found');
        } else {
            this.addIssue('pipeline', '❌ Kanban board not found');
        }

        this.incrementMaxScore();
        const stages = await this.page.$$('.pipeline-stage, .kanban-column');
        if (stages.length >= 5) {
            this.addSuccess('pipeline', `✅ Found ${stages.length} pipeline stages`);
        } else {
            this.addIssue('pipeline', `❌ Only found ${stages.length} pipeline stages`);
        }

        this.incrementMaxScore();
        const cards = await this.page.$$('.kanban-card, .candidate-card');
        if (cards.length > 0) {
            this.addSuccess('pipeline', `✅ Found ${cards.length} candidate cards`);
        } else {
            this.addIssue('pipeline', '❌ No candidate cards found');
        }
    }

    async testAssessments() {
        console.log('\n📝 Testing Assessments...');

        await this.page.goto(`${this.baseUrl}/assessments`);
        await this.page.waitForTimeout(3000);

        this.incrementMaxScore();
        const assessmentsPage = await this.page.$('.assessments, .assessments-list, table');
        if (assessmentsPage) {
            this.addSuccess('assessments', '✅ Assessments page content found');
        } else {
            this.addIssue('assessments', '❌ Assessments page content not found');
        }
    }

    async testSourcing() {
        console.log('\n🔍 Testing Sourcing...');

        await this.page.goto(`${this.baseUrl}/sourcing`);
        await this.page.waitForTimeout(3000);

        this.incrementMaxScore();
        const sourcingPage = await this.page.$('.sourcing, .search, input[type="search"]');
        if (sourcingPage) {
            this.addSuccess('sourcing', '✅ Sourcing page content found');
        } else {
            this.addIssue('sourcing', '❌ Sourcing page content not found');
        }
    }

    async testAIDashboard() {
        console.log('\n🤖 Testing AI Dashboard...');

        await this.page.goto(`${this.baseUrl}/ai-dashboard`);
        await this.page.waitForTimeout(3000);

        this.incrementMaxScore();
        const pageTitle = await this.page.$('h1');
        const titleText = pageTitle ? await this.page.evaluate(el => el.textContent, pageTitle) : '';
        if (titleText.includes('AI Dashboard')) {
            this.addSuccess('ai-dashboard', '✅ AI Dashboard content found');
        } else {
            this.addIssue('ai-dashboard', '❌ AI Dashboard content not found');
        }
    }

    generateReport() {
        const percentage = Math.round((this.results.score / this.results.maxScore) * 100);

        let grade, recommendation;
        if (percentage >= 90) {
            grade = 'A+'; recommendation = 'STRONGLY RECOMMEND';
        } else if (percentage >= 80) {
            grade = 'A'; recommendation = 'RECOMMEND';
        } else if (percentage >= 70) {
            grade = 'B'; recommendation = 'CONDITIONALLY RECOMMEND';
        } else if (percentage >= 60) {
            grade = 'C'; recommendation = 'NOT RECOMMENDED';
        } else {
            grade = 'F'; recommendation = 'DO NOT RECOMMEND';
        }

        console.log('\n🎯 NORTHWESTERN MUTUAL AUDIT RESULTS');
        console.log('═'.repeat(60));
        console.log(`📊 SCORE: ${this.results.score}/${this.results.maxScore} (${percentage}%)`);
        console.log(`📈 GRADE: ${grade}`);
        console.log(`💼 RECOMMENDATION: ${recommendation}`);

        if (this.results.successes.length > 0) {
            console.log('\n✅ SUCCESSES:');
            this.results.successes.forEach(success => console.log(`   ${success}`));
        }

        if (this.results.criticalIssues.length > 0) {
            console.log('\n❌ CRITICAL ISSUES:');
            this.results.criticalIssues.forEach(issue => console.log(`   ${issue}`));
        }

        console.log('\n' + '═'.repeat(60));
        return { grade, percentage, recommendation };
    }

    async runAudit() {
        try {
            await this.init();

            const loginSuccess = await this.testLogin();
            if (loginSuccess) {
                await this.testDashboard();
                await this.testCandidates();
                await this.testPipeline();
                await this.testAssessments();
                await this.testSourcing();
                await this.testAIDashboard();
            } else {
                console.log('❌ Login failed - skipping remaining tests');
            }

            return this.generateReport();

        } catch (error) {
            console.error('❌ Audit failed:', error);
            return { grade: 'F', percentage: 0, recommendation: 'AUDIT FAILED' };
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

const audit = new FocusedNorthwesternAudit();
audit.runAudit().catch(console.error);