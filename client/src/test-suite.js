/**
 * Production Readiness Test Suite
 * Run these tests to verify all functionality works
 */

class ProductionTestSuite {
    constructor() {
        this.testResults = [];
        this.baseURL = 'http://localhost:3001';
    }
    
    async runAllTests() {
        console.log('=== RUNNING PRODUCTION READINESS TESTS ===');
        console.log('Timestamp:', new Date().toISOString());
        
        // Test 1: Can create a candidate via API
        const candidateId = await this.testCreateCandidate();
        
        // Test 2: Can retrieve the created candidate
        await this.testGetCandidate(candidateId);
        
        // Test 3: Candidate appears in pipeline
        await this.testPipelineView(candidateId);
        
        // Test 4: Candidate appears in dashboard overview
        await this.testDashboardOverview();
        
        // Test 5: AI Dashboard functionality
        await this.testAIDashboard();
        
        // Test 6: Resume parsing functionality
        await this.testResumeParsing();
        
        // Test 7: Database integrity
        await this.testDatabaseIntegrity();
        
        // Print results
        this.printResults();
        
        return this.testResults;
    }
    
    async testCreateCandidate() {
        console.log('\n--- Test 1: Create Candidate ---');
        
        try {
            const testCandidate = {
                first_name: 'Test',
                last_name: 'User_' + Date.now(),
                email: `test_${Date.now()}@example.com`,
                phone: '555-0100',
                status: 'new',
                source: 'test_suite'
            };
            
            const response = await fetch(`${this.baseURL}/api/candidates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getTestToken()}`
                },
                body: JSON.stringify(testCandidate)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ PASS - Create Candidate:', result.id ? 'SUCCESS' : 'FAILED', result);
            
            this.testResults.push({
                test: 'Create Candidate',
                status: result.id ? 'PASS' : 'FAIL',
                details: result
            });
            
            return result.id;
        } catch (error) {
            console.log('❌ FAIL - Create Candidate:', error.message);
            this.testResults.push({
                test: 'Create Candidate',
                status: 'FAIL',
                error: error.message
            });
            return null;
        }
    }
    
    async testGetCandidate(candidateId) {
        console.log('\n--- Test 2: Retrieve Candidate ---');
        
        if (!candidateId) {
            console.log('❌ SKIP - No candidate ID from previous test');
            this.testResults.push({
                test: 'Retrieve Candidate',
                status: 'SKIP',
                reason: 'No candidate ID from previous test'
            });
            return;
        }
        
        try {
            const response = await fetch(`${this.baseURL}/api/candidates`, {
                headers: {
                    'Authorization': `Bearer ${this.getTestToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const candidates = await response.json();
            const found = candidates.find(c => c.id === candidateId);
            
            console.log('✅ PASS - Retrieve Candidate:', found ? 'FOUND' : 'NOT FOUND');
            
            this.testResults.push({
                test: 'Retrieve Candidate',
                status: found ? 'PASS' : 'FAIL',
                details: found ? 'Candidate found in list' : 'Candidate not found in list'
            });
            
            return found;
        } catch (error) {
            console.log('❌ FAIL - Retrieve Candidate:', error.message);
            this.testResults.push({
                test: 'Retrieve Candidate',
                status: 'FAIL',
                error: error.message
            });
            return null;
        }
    }
    
    async testPipelineView(candidateId) {
        console.log('\n--- Test 3: Pipeline View ---');
        
        if (!candidateId) {
            console.log('❌ SKIP - No candidate ID from previous test');
            this.testResults.push({
                test: 'Pipeline View',
                status: 'SKIP',
                reason: 'No candidate ID from previous test'
            });
            return;
        }
        
        try {
            const response = await fetch(`${this.baseURL}/api/pipeline/view`, {
                headers: {
                    'Authorization': `Bearer ${this.getTestToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const pipeline = await response.json();
            let found = false;
            
            pipeline.forEach(stage => {
                if (stage.candidates && stage.candidates.find(c => c.id === candidateId)) {
                    found = true;
                }
            });
            
            console.log('✅ PASS - Pipeline View:', found ? 'CANDIDATE FOUND IN PIPELINE' : 'CANDIDATE NOT IN PIPELINE');
            
            this.testResults.push({
                test: 'Pipeline View',
                status: found ? 'PASS' : 'FAIL',
                details: found ? 'Candidate found in pipeline' : 'Candidate not found in pipeline'
            });
            
            return found;
        } catch (error) {
            console.log('❌ FAIL - Pipeline View:', error.message);
            this.testResults.push({
                test: 'Pipeline View',
                status: 'FAIL',
                error: error.message
            });
            return false;
        }
    }
    
    async testDashboardOverview() {
        console.log('\n--- Test 4: Dashboard Overview ---');
        
        try {
            const response = await fetch(`${this.baseURL}/api/dashboard/overview`, {
                headers: {
                    'Authorization': `Bearer ${this.getTestToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const hasStats = data.stats && data.stats.total_candidates;
            const hasRecentCandidates = data.recentCandidates && data.recentCandidates.length > 0;
            
            console.log('✅ PASS - Dashboard Overview:', hasStats && hasRecentCandidates ? 'DATA AVAILABLE' : 'NO DATA');
            
            this.testResults.push({
                test: 'Dashboard Overview',
                status: hasStats && hasRecentCandidates ? 'PASS' : 'FAIL',
                details: {
                    hasStats,
                    hasRecentCandidates,
                    totalCandidates: data.stats?.total_candidates || 0
                }
            });
            
            return data;
        } catch (error) {
            console.log('❌ FAIL - Dashboard Overview:', error.message);
            this.testResults.push({
                test: 'Dashboard Overview',
                status: 'FAIL',
                error: error.message
            });
            return null;
        }
    }
    
    async testAIDashboard() {
        console.log('\n--- Test 5: AI Dashboard ---');
        
        try {
            const response = await fetch(`${this.baseURL}/api/v3/ai/test`, {
                headers: {
                    'Authorization': `Bearer ${this.getTestToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const isWorking = data.success === true;
            
            console.log('✅ PASS - AI Dashboard:', isWorking ? 'AI ROUTES WORKING' : 'AI ROUTES FAILED');
            
            this.testResults.push({
                test: 'AI Dashboard',
                status: isWorking ? 'PASS' : 'FAIL',
                details: data
            });
            
            return data;
        } catch (error) {
            console.log('❌ FAIL - AI Dashboard:', error.message);
            this.testResults.push({
                test: 'AI Dashboard',
                status: 'FAIL',
                error: error.message
            });
            return null;
        }
    }
    
    async testResumeParsing() {
        console.log('\n--- Test 6: Resume Parsing ---');
        
        try {
            // Create a test resume content
            const testResumeContent = `
John Doe
Software Engineer
john.doe@test.com
(555) 123-4567

EXPERIENCE:
- 5 years of software development
- JavaScript, Python, React, Node.js
- PostgreSQL, MongoDB

SKILLS:
JavaScript, Python, React, Node.js, PostgreSQL, MongoDB, Git
            `;
            
            // Create a blob for the test
            const blob = new Blob([testResumeContent], { type: 'text/plain' });
            const formData = new FormData();
            formData.append('resume', blob, 'test-resume.txt');
            
            const response = await fetch(`${this.baseURL}/api/v3/ai/parse-resume`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getTestToken()}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const isWorking = data.success === true && data.data && data.data.name;
            
            console.log('✅ PASS - Resume Parsing:', isWorking ? 'PARSING WORKING' : 'PARSING FAILED');
            
            this.testResults.push({
                test: 'Resume Parsing',
                status: isWorking ? 'PASS' : 'FAIL',
                details: data
            });
            
            return data;
        } catch (error) {
            console.log('❌ FAIL - Resume Parsing:', error.message);
            this.testResults.push({
                test: 'Resume Parsing',
                status: 'FAIL',
                error: error.message
            });
            return null;
        }
    }
    
    async testDatabaseIntegrity() {
        console.log('\n--- Test 7: Database Integrity ---');
        
        try {
            // Test database connectivity by checking candidates count
            const response = await fetch(`${this.baseURL}/api/candidates`, {
                headers: {
                    'Authorization': `Bearer ${this.getTestToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const candidates = await response.json();
            const hasCandidates = Array.isArray(candidates) && candidates.length > 0;
            
            console.log('✅ PASS - Database Integrity:', hasCandidates ? 'DATABASE CONNECTED' : 'NO DATA');
            
            this.testResults.push({
                test: 'Database Integrity',
                status: hasCandidates ? 'PASS' : 'FAIL',
                details: {
                    candidateCount: candidates.length,
                    hasData: hasCandidates
                }
            });
            
            return candidates;
        } catch (error) {
            console.log('❌ FAIL - Database Integrity:', error.message);
            this.testResults.push({
                test: 'Database Integrity',
                status: 'FAIL',
                error: error.message
            });
            return null;
        }
    }
    
    getTestToken() {
        // Return a test token - in production this would be a real token
        return localStorage.getItem('accessToken') || 'test-token';
    }
    
    printResults() {
        console.log('\n=== TEST RESULTS SUMMARY ===');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const skipped = this.testResults.filter(r => r.status === 'SKIP').length;
        
        console.log(`Total Tests: ${this.testResults.length}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️ Skipped: ${skipped}`);
        
        if (failed > 0) {
            console.log('\n--- FAILED TESTS ---');
            this.testResults.filter(r => r.status === 'FAIL').forEach(test => {
                console.log(`❌ ${test.test}: ${test.error || 'Unknown error'}`);
            });
        }
        
        console.log('\n--- ALL TEST DETAILS ---');
        this.testResults.forEach(test => {
            console.log(`${test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⏭️'} ${test.test}: ${test.status}`);
            if (test.details) {
                console.log('   Details:', test.details);
            }
            if (test.error) {
                console.log('   Error:', test.error);
            }
        });
        
        console.log('\n=== PRODUCTION READINESS ===');
        if (failed === 0) {
            console.log('🎉 ALL TESTS PASSED - READY FOR PRODUCTION!');
        } else {
            console.log('⚠️ SOME TESTS FAILED - NOT READY FOR PRODUCTION');
            console.log('Fix the failed tests before deploying to production.');
        }
    }
}

// Make it globally available
window.ProductionTestSuite = ProductionTestSuite;

// Auto-run tests if this script is loaded
if (typeof window !== 'undefined') {
    console.log('Production Test Suite loaded. Run window.ProductionTestSuite().runAllTests() to start tests.');
}

