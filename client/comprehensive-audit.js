import { chromium } from 'playwright';

class NorthwesternMutualPlatformAudit {
    constructor() {
        this.browser = null;
        this.page = null;
        this.context = null;
        this.baseUrl = 'http://localhost:5174';
        this.auditResults = {
            timestamp: new Date().toISOString(),
            overall: { score: 0, maxScore: 0, issues: [], successes: [] },
            modules: {}
        };
    }

    async init() {
        console.log('🚀 Initializing Northwestern Mutual Platform Comprehensive Audit...');
        this.browser = await chromium.launch({
            headless: false,
            slowMo: 300,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            recordVideo: { dir: 'audit-videos/', size: { width: 1920, height: 1080 } }
        });
        this.page = await this.context.newPage();

        // Set up comprehensive monitoring
        this.setupMonitoring();
    }

    setupMonitoring() {
        // Monitor console errors
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                this.addIssue('console', `Console Error: ${msg.text()}`);
            }
        });

        // Monitor network failures
        this.page.on('requestfailed', request => {
            this.addIssue('network', `Failed Request: ${request.url()} - ${request.failure().errorText}`);
        });

        // Monitor uncaught exceptions
        this.page.on('pageerror', error => {
            this.addIssue('javascript', `Page Error: ${error.message}`);
        });
    }

    addIssue(category, issue) {
        this.auditResults.overall.issues.push({ category, issue, timestamp: new Date().toISOString() });
    }

    addSuccess(category, success) {
        this.auditResults.overall.successes.push({ category, success, timestamp: new Date().toISOString() });
        this.auditResults.overall.score += 1;
    }

    incrementMaxScore() {
        this.auditResults.overall.maxScore += 1;
    }

    async auditLogin() {
        console.log('\n🔐 === AUDITING LOGIN & AUTHENTICATION ===');
        this.auditResults.modules.login = { score: 0, maxScore: 0, issues: [], successes: [] };

        try {
            // Test 1: Page loads successfully
            this.incrementMaxScore();
            await this.page.goto(this.baseUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(2000);

            const title = await this.page.title();
            if (title && title.trim() !== '') {
                this.addSuccess('login', `✅ Application loads successfully with title: "${title}"`);
                this.auditResults.modules.login.score += 1;
            } else {
                this.addIssue('login', '❌ Page loads but has no title');
            }
            this.auditResults.modules.login.maxScore += 1;

            // Test 2: Login form elements exist
            this.incrementMaxScore();
            const emailField = await this.page.$('input[type="email"]');
            const passwordField = await this.page.$('input[type="password"]');
            const submitButton = await this.page.$('button[type="submit"]');

            if (emailField && passwordField && submitButton) {
                this.addSuccess('login', '✅ All login form elements present');
                this.auditResults.modules.login.score += 1;
            } else {
                this.addIssue('login', '❌ Missing login form elements');
            }
            this.auditResults.modules.login.maxScore += 1;

            // Test 3: Login functionality with demo credentials
            this.incrementMaxScore();
            await this.page.fill('input[type="email"]', 'demo@northwestern.com');
            await this.page.fill('input[type="password"]', 'password123');

            // Monitor for navigation/success
            const navigationPromise = this.page.waitForNavigation({ timeout: 10000 }).catch(() => null);
            await this.page.click('button[type="submit"]');

            await Promise.race([
                navigationPromise,
                this.page.waitForTimeout(5000)
            ]);

            // Check if login was successful
            const currentUrl = this.page.url();
            const hasNavigation = await this.page.$('nav, .nav, .navigation') !== null;
            const hasUserInfo = await this.page.$('.user-info, .profile, .user-menu') !== null;

            if (currentUrl !== this.baseUrl || hasNavigation || hasUserInfo) {
                this.addSuccess('login', '✅ Login successful - redirected or UI changed');
                this.auditResults.modules.login.score += 1;
            } else {
                this.addIssue('login', '❌ Login appears to have failed - no redirect or UI change');
            }
            this.auditResults.modules.login.maxScore += 1;

            // Test 4: Session persistence
            this.incrementMaxScore();
            await this.page.reload({ waitUntil: 'networkidle' });
            await this.page.waitForTimeout(2000);

            const stillLoggedIn = await this.page.$('nav, .nav, .navigation') !== null;
            if (stillLoggedIn) {
                this.addSuccess('login', '✅ Session persists after page reload');
                this.auditResults.modules.login.score += 1;
            } else {
                this.addIssue('login', '❌ Session does not persist after reload');
            }
            this.auditResults.modules.login.maxScore += 1;

        } catch (error) {
            this.addIssue('login', `❌ Login audit failed: ${error.message}`);
        }

        console.log(`Login Audit Complete: ${this.auditResults.modules.login.score}/${this.auditResults.modules.login.maxScore}`);
    }

    async auditDashboard() {
        console.log('\n📊 === AUDITING DASHBOARD ===');
        this.auditResults.modules.dashboard = { score: 0, maxScore: 0, issues: [], successes: [] };

        try {
            // Navigate to dashboard
            await this.page.goto(`${this.baseUrl}/`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);

            // Test 1: Dashboard content loads
            this.incrementMaxScore();
            const dashboardContent = await this.page.$('[data-testid="dashboard-content"], .dashboard, main');
            if (dashboardContent) {
                this.addSuccess('dashboard', '✅ Dashboard content area exists');
                this.auditResults.modules.dashboard.score += 1;
            } else {
                this.addIssue('dashboard', '❌ Dashboard content area not found');
            }
            this.auditResults.modules.dashboard.maxScore += 1;

            // Test 2: Metrics cards exist
            this.incrementMaxScore();
            const metricCards = await this.page.$$('.metric-card, .dashboard-card, [class*="metric"]');
            if (metricCards.length > 0) {
                this.addSuccess('dashboard', `✅ Found ${metricCards.length} metric cards`);
                this.auditResults.modules.dashboard.score += 1;
            } else {
                this.addIssue('dashboard', '❌ No metric cards found');
            }
            this.auditResults.modules.dashboard.maxScore += 1;

            // Test 3: Pipeline health analytics
            this.incrementMaxScore();
            const pipelineHealth = await this.page.$('.pipeline-health, [data-testid="pipeline-health"]');
            if (pipelineHealth) {
                const content = await this.page.evaluate(el => el.textContent, pipelineHealth);
                if (content && content.trim().length > 20) {
                    this.addSuccess('dashboard', '✅ Pipeline health analytics has content');
                    this.auditResults.modules.dashboard.score += 1;
                } else {
                    this.addIssue('dashboard', '❌ Pipeline health analytics appears empty');
                }
            } else {
                this.addIssue('dashboard', '❌ Pipeline health analytics section not found');
            }
            this.auditResults.modules.dashboard.maxScore += 1;

            // Test 4: Navigation menu
            this.incrementMaxScore();
            const navItems = await this.page.$$('nav a, .nav a, [role="navigation"] a');
            if (navItems.length >= 5) {
                this.addSuccess('dashboard', `✅ Navigation menu has ${navItems.length} items`);
                this.auditResults.modules.dashboard.score += 1;
            } else {
                this.addIssue('dashboard', `❌ Navigation menu has only ${navItems.length} items (expected 5+)`);
            }
            this.auditResults.modules.dashboard.maxScore += 1;

        } catch (error) {
            this.addIssue('dashboard', `❌ Dashboard audit failed: ${error.message}`);
        }

        console.log(`Dashboard Audit Complete: ${this.auditResults.modules.dashboard.score}/${this.auditResults.modules.dashboard.maxScore}`);
    }

    async auditCandidates() {
        console.log('\n👥 === AUDITING CANDIDATES MODULE ===');
        this.auditResults.modules.candidates = { score: 0, maxScore: 0, issues: [], successes: [] };

        try {
            // Navigate to candidates
            await this.page.goto(`${this.baseUrl}/candidates`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);

            // Test 1: Candidates page loads
            this.incrementMaxScore();
            const candidatesContent = await this.page.$('.candidates, [data-testid="candidates"], table, .candidate-list');
            if (candidatesContent) {
                this.addSuccess('candidates', '✅ Candidates page loads with content area');
                this.auditResults.modules.candidates.score += 1;
            } else {
                this.addIssue('candidates', '❌ Candidates page content not found');
            }
            this.auditResults.modules.candidates.maxScore += 1;

            // Test 2: Candidate data displays
            this.incrementMaxScore();
            const candidateRows = await this.page.$$('tr, .candidate-item, .candidate-card');
            if (candidateRows.length > 1) { // More than header row
                this.addSuccess('candidates', `✅ Found ${candidateRows.length} candidate entries`);
                this.auditResults.modules.candidates.score += 1;
            } else {
                this.addIssue('candidates', '❌ No candidate data found');
            }
            this.auditResults.modules.candidates.maxScore += 1;

            // Test 3: Add candidate functionality
            this.incrementMaxScore();
            const addButton = await this.page.$('button:has-text("Add"), .add-candidate, [data-testid="add-candidate"]');
            if (addButton) {
                this.addSuccess('candidates', '✅ Add candidate button exists');
                this.auditResults.modules.candidates.score += 1;

                // Test button click
                try {
                    await addButton.click();
                    await this.page.waitForTimeout(1000);
                    const modal = await this.page.$('.modal, .dialog, .form');
                    if (modal) {
                        this.addSuccess('candidates', '✅ Add candidate form opens');
                    }
                } catch (e) {
                    this.addIssue('candidates', '❌ Add candidate button click failed');
                }
            } else {
                this.addIssue('candidates', '❌ Add candidate button not found');
            }
            this.auditResults.modules.candidates.maxScore += 1;

            // Test 4: Search/filter functionality
            this.incrementMaxScore();
            const searchInput = await this.page.$('input[type="search"], input[placeholder*="search"], .search-input');
            if (searchInput) {
                this.addSuccess('candidates', '✅ Search functionality exists');
                this.auditResults.modules.candidates.score += 1;
            } else {
                this.addIssue('candidates', '❌ Search functionality not found');
            }
            this.auditResults.modules.candidates.maxScore += 1;

        } catch (error) {
            this.addIssue('candidates', `❌ Candidates audit failed: ${error.message}`);
        }

        console.log(`Candidates Audit Complete: ${this.auditResults.modules.candidates.score}/${this.auditResults.modules.candidates.maxScore}`);
    }

    async auditPipeline() {
        console.log('\n🔄 === AUDITING PIPELINE MODULE ===');
        this.auditResults.modules.pipeline = { score: 0, maxScore: 0, issues: [], successes: [] };

        try {
            // Navigate to pipeline
            await this.page.goto(`${this.baseUrl}/pipeline`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);

            // Test 1: Pipeline page loads
            this.incrementMaxScore();
            const pipelineContent = await this.page.$('.kanban-board, [data-testid="kanban-board"], .pipeline');
            if (pipelineContent) {
                this.addSuccess('pipeline', '✅ Pipeline page loads with kanban board');
                this.auditResults.modules.pipeline.score += 1;
            } else {
                this.addIssue('pipeline', '❌ Pipeline kanban board not found');
            }
            this.auditResults.modules.pipeline.maxScore += 1;

            // Test 2: Pipeline stages
            this.incrementMaxScore();
            const stageColumns = await this.page.$$('.pipeline-stage, .kanban-column, [data-rbd-droppable-id]');
            if (stageColumns.length >= 5) {
                this.addSuccess('pipeline', `✅ Found ${stageColumns.length} pipeline stages`);
                this.auditResults.modules.pipeline.score += 1;

                // Check for duplicate stages
                const stageNames = [];
                for (let column of stageColumns) {
                    const name = await this.page.evaluate(el => {
                        const header = el.querySelector('h3, h2, .stage-name');
                        return header ? header.textContent.trim() : '';
                    }, column);
                    stageNames.push(name);
                }

                const uniqueNames = [...new Set(stageNames)];
                if (uniqueNames.length === stageNames.length) {
                    this.addSuccess('pipeline', '✅ No duplicate pipeline stages detected');
                } else {
                    this.addIssue('pipeline', `❌ Duplicate pipeline stages detected: ${stageNames.length} total, ${uniqueNames.length} unique`);
                }

            } else {
                this.addIssue('pipeline', `❌ Only found ${stageColumns.length} pipeline stages (expected 5+)`);
            }
            this.auditResults.modules.pipeline.maxScore += 1;

            // Test 3: Candidate cards
            this.incrementMaxScore();
            const candidateCards = await this.page.$$('.kanban-card, .candidate-card, [data-rbd-draggable-id]');
            if (candidateCards.length > 0) {
                this.addSuccess('pipeline', `✅ Found ${candidateCards.length} candidate cards in pipeline`);
                this.auditResults.modules.pipeline.score += 1;
            } else {
                this.addIssue('pipeline', '❌ No candidate cards found in pipeline');
            }
            this.auditResults.modules.pipeline.maxScore += 1;

            // Test 4: Drag and drop visual feedback
            this.incrementMaxScore();
            if (candidateCards.length > 0 && stageColumns.length > 1) {
                try {
                    const sourceCard = candidateCards[0];
                    const targetColumn = stageColumns[1];

                    // Simulate drag start
                    const bounds = await sourceCard.boundingBox();
                    await this.page.mouse.move(bounds.x + bounds.width/2, bounds.y + bounds.height/2);
                    await this.page.mouse.down();
                    await this.page.waitForTimeout(200);

                    // Check for visual feedback (shadow, highlighting, etc.)
                    const isDragging = await this.page.evaluate(() => {
                        return document.querySelector('[class*="dragging"], [style*="shadow"], .is-dragging') !== null;
                    });

                    await this.page.mouse.up();

                    if (isDragging) {
                        this.addSuccess('pipeline', '✅ Drag and drop provides visual feedback');
                        this.auditResults.modules.pipeline.score += 1;
                    } else {
                        this.addIssue('pipeline', '❌ No visual feedback during drag and drop');
                    }
                } catch (e) {
                    this.addIssue('pipeline', `❌ Drag and drop test failed: ${e.message}`);
                }
            } else {
                this.addIssue('pipeline', '❌ Cannot test drag and drop - insufficient cards or columns');
            }
            this.auditResults.modules.pipeline.maxScore += 1;

        } catch (error) {
            this.addIssue('pipeline', `❌ Pipeline audit failed: ${error.message}`);
        }

        console.log(`Pipeline Audit Complete: ${this.auditResults.modules.pipeline.score}/${this.auditResults.modules.pipeline.maxScore}`);
    }

    async auditAssessments() {
        console.log('\n📝 === AUDITING ASSESSMENTS MODULE ===');
        this.auditResults.modules.assessments = { score: 0, maxScore: 0, issues: [], successes: [] };

        try {
            // Navigate to assessments
            await this.page.goto(`${this.baseUrl}/assessments`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);

            // Test 1: Assessments page loads
            this.incrementMaxScore();
            const assessmentsContent = await this.page.$('.assessments, [data-testid="assessments"], .assessments-list');
            if (assessmentsContent) {
                this.addSuccess('assessments', '✅ Assessments page loads');
                this.auditResults.modules.assessments.score += 1;
            } else {
                this.addIssue('assessments', '❌ Assessments page content not found');
            }
            this.auditResults.modules.assessments.maxScore += 1;

            // Test 2: Assessment data
            this.incrementMaxScore();
            const assessmentItems = await this.page.$$('tr, .assessment-item, .assessment-card');
            if (assessmentItems.length > 1) {
                this.addSuccess('assessments', `✅ Found ${assessmentItems.length} assessment entries`);
                this.auditResults.modules.assessments.score += 1;
            } else {
                this.addIssue('assessments', '❌ No assessment data found');
            }
            this.auditResults.modules.assessments.maxScore += 1;

            // Test 3: Create assessment functionality
            this.incrementMaxScore();
            const createButton = await this.page.$('button:has-text("Create"), .create-assessment, [data-testid="create-assessment"]');
            if (createButton) {
                this.addSuccess('assessments', '✅ Create assessment button exists');
                this.auditResults.modules.assessments.score += 1;
            } else {
                this.addIssue('assessments', '❌ Create assessment button not found');
            }
            this.auditResults.modules.assessments.maxScore += 1;

        } catch (error) {
            this.addIssue('assessments', `❌ Assessments audit failed: ${error.message}`);
        }

        console.log(`Assessments Audit Complete: ${this.auditResults.modules.assessments.score}/${this.auditResults.modules.assessments.maxScore}`);
    }

    async auditSourcing() {
        console.log('\n🔍 === AUDITING SOURCING MODULE ===');
        this.auditResults.modules.sourcing = { score: 0, maxScore: 0, issues: [], successes: [] };

        try {
            // Navigate to sourcing
            await this.page.goto(`${this.baseUrl}/sourcing`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);

            // Test 1: Sourcing page loads
            this.incrementMaxScore();
            const sourcingContent = await this.page.$('.sourcing, [data-testid="sourcing"], .search');
            if (sourcingContent) {
                this.addSuccess('sourcing', '✅ Sourcing page loads');
                this.auditResults.modules.sourcing.score += 1;
            } else {
                this.addIssue('sourcing', '❌ Sourcing page content not found');
            }
            this.auditResults.modules.sourcing.maxScore += 1;

            // Test 2: Search functionality
            this.incrementMaxScore();
            const searchInput = await this.page.$('input[type="search"], input[placeholder*="search"], .search-input');
            if (searchInput) {
                this.addSuccess('sourcing', '✅ Search input exists');
                this.auditResults.modules.sourcing.score += 1;
            } else {
                this.addIssue('sourcing', '❌ Search input not found');
            }
            this.auditResults.modules.sourcing.maxScore += 1;

            // Test 3: Search filters
            this.incrementMaxScore();
            const filters = await this.page.$$('select, .filter, .dropdown, button[role="button"]');
            if (filters.length > 0) {
                this.addSuccess('sourcing', `✅ Found ${filters.length} search filters`);
                this.auditResults.modules.sourcing.score += 1;
            } else {
                this.addIssue('sourcing', '❌ No search filters found');
            }
            this.auditResults.modules.sourcing.maxScore += 1;

            // Test 4: Search button
            this.incrementMaxScore();
            const searchButton = await this.page.$('button:has-text("Search"), .search-button, [data-testid="search-button"]');
            if (searchButton) {
                this.addSuccess('sourcing', '✅ Search button exists');
                this.auditResults.modules.sourcing.score += 1;
            } else {
                this.addIssue('sourcing', '❌ Search button not found');
            }
            this.auditResults.modules.sourcing.maxScore += 1;

        } catch (error) {
            this.addIssue('sourcing', `❌ Sourcing audit failed: ${error.message}`);
        }

        console.log(`Sourcing Audit Complete: ${this.auditResults.modules.sourcing.score}/${this.auditResults.modules.sourcing.maxScore}`);
    }

    async auditAIDashboard() {
        console.log('\n🤖 === AUDITING AI DASHBOARD ===');
        this.auditResults.modules.aiDashboard = { score: 0, maxScore: 0, issues: [], successes: [] };

        try {
            // Navigate to AI dashboard
            await this.page.goto(`${this.baseUrl}/ai-dashboard`, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);

            // Test 1: AI Dashboard loads
            this.incrementMaxScore();
            const aiContent = await this.page.$('.ai-dashboard, [data-testid="ai-dashboard"], .analytics');
            if (aiContent) {
                this.addSuccess('aiDashboard', '✅ AI Dashboard page loads');
                this.auditResults.modules.aiDashboard.score += 1;
            } else {
                this.addIssue('aiDashboard', '❌ AI Dashboard content not found');
            }
            this.auditResults.modules.aiDashboard.maxScore += 1;

            // Test 2: Analytics components
            this.incrementMaxScore();
            const analyticsComponents = await this.page.$$('.chart, .graph, .metric, .analytics-card');
            if (analyticsComponents.length > 0) {
                this.addSuccess('aiDashboard', `✅ Found ${analyticsComponents.length} analytics components`);
                this.auditResults.modules.aiDashboard.score += 1;
            } else {
                this.addIssue('aiDashboard', '❌ No analytics components found');
            }
            this.auditResults.modules.aiDashboard.maxScore += 1;

        } catch (error) {
            this.addIssue('aiDashboard', `❌ AI Dashboard audit failed: ${error.message}`);
        }

        console.log(`AI Dashboard Audit Complete: ${this.auditResults.modules.aiDashboard.score}/${this.auditResults.modules.aiDashboard.maxScore}`);
    }

    async auditResponsiveDesign() {
        console.log('\n📱 === AUDITING RESPONSIVE DESIGN ===');
        this.auditResults.modules.responsive = { score: 0, maxScore: 0, issues: [], successes: [] };

        try {
            // Test different viewport sizes
            const viewports = [
                { width: 1920, height: 1080, name: 'Desktop Large' },
                { width: 1366, height: 768, name: 'Desktop Standard' },
                { width: 768, height: 1024, name: 'Tablet' },
                { width: 375, height: 667, name: 'Mobile' }
            ];

            for (const viewport of viewports) {
                this.incrementMaxScore();
                await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
                await this.page.waitForTimeout(1000);

                // Check if content is still accessible
                const navigation = await this.page.$('nav, .nav, .navigation');
                const content = await this.page.$('main, .main, .content, [role="main"]');

                if (navigation && content) {
                    this.addSuccess('responsive', `✅ ${viewport.name} (${viewport.width}x${viewport.height}) layout works`);
                    this.auditResults.modules.responsive.score += 1;
                } else {
                    this.addIssue('responsive', `❌ ${viewport.name} layout broken - missing navigation or content`);
                }
                this.auditResults.modules.responsive.maxScore += 1;
            }

            // Reset to desktop
            await this.page.setViewportSize({ width: 1920, height: 1080 });

        } catch (error) {
            this.addIssue('responsive', `❌ Responsive design audit failed: ${error.message}`);
        }

        console.log(`Responsive Design Audit Complete: ${this.auditResults.modules.responsive.score}/${this.auditResults.modules.responsive.maxScore}`);
    }

    async auditPerformance() {
        console.log('\n⚡ === AUDITING PERFORMANCE ===');
        this.auditResults.modules.performance = { score: 0, maxScore: 0, issues: [], successes: [] };

        try {
            // Test page load times
            const pages = ['/', '/candidates', '/pipeline', '/assessments', '/sourcing'];

            for (const page of pages) {
                this.incrementMaxScore();
                const startTime = Date.now();
                await this.page.goto(`${this.baseUrl}${page}`, { waitUntil: 'networkidle' });
                const loadTime = Date.now() - startTime;

                if (loadTime < 3000) {
                    this.addSuccess('performance', `✅ ${page} loads in ${loadTime}ms (good)`);
                    this.auditResults.modules.performance.score += 1;
                } else if (loadTime < 5000) {
                    this.addSuccess('performance', `⚠️ ${page} loads in ${loadTime}ms (acceptable)`);
                    this.auditResults.modules.performance.score += 0.5;
                } else {
                    this.addIssue('performance', `❌ ${page} loads in ${loadTime}ms (slow)`);
                }
                this.auditResults.modules.performance.maxScore += 1;
            }

        } catch (error) {
            this.addIssue('performance', `❌ Performance audit failed: ${error.message}`);
        }

        console.log(`Performance Audit Complete: ${this.auditResults.modules.performance.score}/${this.auditResults.modules.performance.maxScore}`);
    }

    generateReport() {
        console.log('\n📄 === GENERATING COMPREHENSIVE AUDIT REPORT ===');

        const totalScore = Object.values(this.auditResults.modules).reduce((sum, module) => sum + module.score, 0);
        const totalMaxScore = Object.values(this.auditResults.modules).reduce((sum, module) => sum + module.maxScore, 0);
        const overallPercentage = Math.round((totalScore / totalMaxScore) * 100);

        console.log('\n🎯 NORTHWESTERN MUTUAL PLATFORM AUDIT RESULTS');
        console.log('═'.repeat(80));
        console.log(`📊 OVERALL SCORE: ${totalScore}/${totalMaxScore} (${overallPercentage}%)`);
        console.log(`🕐 Audit Completed: ${this.auditResults.timestamp}`);

        // Grade the platform
        let grade, recommendation;
        if (overallPercentage >= 90) {
            grade = 'A+';
            recommendation = 'STRONGLY RECOMMEND for organizational use';
        } else if (overallPercentage >= 80) {
            grade = 'A';
            recommendation = 'RECOMMEND for organizational use with minor improvements';
        } else if (overallPercentage >= 70) {
            grade = 'B';
            recommendation = 'CONDITIONALLY RECOMMEND with significant improvements needed';
        } else if (overallPercentage >= 60) {
            grade = 'C';
            recommendation = 'NOT RECOMMENDED without major fixes';
        } else {
            grade = 'F';
            recommendation = 'DO NOT RECOMMEND for organizational use';
        }

        console.log(`📈 PLATFORM GRADE: ${grade}`);
        console.log(`💼 RECOMMENDATION: ${recommendation}`);
        console.log('\n📋 MODULE BREAKDOWN:');
        console.log('─'.repeat(80));

        Object.entries(this.auditResults.modules).forEach(([moduleName, results]) => {
            const percentage = Math.round((results.score / results.maxScore) * 100);
            const status = percentage >= 80 ? '✅' : percentage >= 60 ? '⚠️' : '❌';
            console.log(`${status} ${moduleName.toUpperCase()}: ${results.score}/${results.maxScore} (${percentage}%)`);
        });

        // Critical Issues
        const criticalIssues = this.auditResults.overall.issues.filter(issue =>
            issue.issue.includes('❌') || issue.issue.includes('failed')
        );

        if (criticalIssues.length > 0) {
            console.log('\n🚨 CRITICAL ISSUES FOUND:');
            console.log('─'.repeat(80));
            criticalIssues.slice(0, 10).forEach((issue, index) => {
                console.log(`${index + 1}. [${issue.category.toUpperCase()}] ${issue.issue}`);
            });
            if (criticalIssues.length > 10) {
                console.log(`... and ${criticalIssues.length - 10} more issues`);
            }
        }

        // Key Successes
        const keySuccesses = this.auditResults.overall.successes.filter(success =>
            success.success.includes('✅')
        );

        if (keySuccesses.length > 0) {
            console.log('\n✨ KEY STRENGTHS:');
            console.log('─'.repeat(80));
            keySuccesses.slice(0, 10).forEach((success, index) => {
                console.log(`${index + 1}. [${success.category.toUpperCase()}] ${success.success}`);
            });
        }

        console.log('\n' + '═'.repeat(80));
        console.log('🎯 EXECUTIVE SUMMARY FOR NORTHWESTERN MUTUAL:');
        console.log('═'.repeat(80));
        console.log(recommendation);
        console.log(`Platform demonstrates ${overallPercentage}% functionality with grade: ${grade}`);

        return {
            grade,
            percentage: overallPercentage,
            recommendation,
            totalIssues: criticalIssues.length,
            totalSuccesses: keySuccesses.length,
            moduleBreakdown: this.auditResults.modules
        };
    }

    async runFullAudit() {
        try {
            await this.init();

            await this.auditLogin();
            await this.auditDashboard();
            await this.auditCandidates();
            await this.auditPipeline();
            await this.auditAssessments();
            await this.auditSourcing();
            await this.auditAIDashboard();
            await this.auditResponsiveDesign();
            await this.auditPerformance();

            const finalReport = this.generateReport();

            return finalReport;

        } catch (error) {
            console.error('❌ Audit failed:', error);
            return { grade: 'F', percentage: 0, recommendation: 'AUDIT FAILED - Cannot evaluate platform' };
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// Run the comprehensive audit
const audit = new NorthwesternMutualPlatformAudit();
audit.runFullAudit().catch(console.error);