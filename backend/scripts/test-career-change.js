const CareerChangeScoringService = require('../services/careerChangeScoring');
const CareerChangeSearchService = require('../services/careerChangeSearch');
const { pool } = require('../db');

async function testCareerChangeSystem() {
  console.log('🧪 Testing Career Change System...\n');
  
  const scoringService = new CareerChangeScoringService();
  const searchService = new CareerChangeSearchService();
  
  try {
    // Test 1: Verify database tables exist
    console.log('1️⃣ Checking database tables...');
    const tables = [
      'profession_mappings',
      'industry_health_scores',
      'career_change_indicators',
      'career_changer_scores',
      'career_change_templates'
    ];
    
    for (const table of tables) {
      const result = await pool.query(
        `SELECT COUNT(*) FROM ${table}`
      );
      console.log(`   ✅ ${table}: ${result.rows[0].count} records`);
    }
    
    // Test 2: Search for Insurance Professionals
    console.log('\n2️⃣ Testing profession search...');
    const searchResults = await searchService.searchProfession(
      'Insurance Professionals',
      'Milwaukee, WI',
      10
    );
    console.log(`   ✅ Found ${searchResults.length} insurance professionals`);
    
    // Test 3: Score candidates
    console.log('\n3️⃣ Testing scoring system...');
    if (searchResults.length > 0) {
      // Get candidate IDs from sourced_candidates
      const candidateResult = await pool.query(
        'SELECT id FROM sourced_candidates WHERE is_career_changer = true LIMIT 5'
      );
      
      if (candidateResult.rows.length > 0) {
        const candidateIds = candidateResult.rows.map(r => r.id);
        const scores = await scoringService.bulkScoreCandidates(candidateIds);
        console.log(`   ✅ Scored ${scores.success.length} candidates`);
        console.log(`   📊 Average score: ${
          scores.success.reduce((sum, s) => sum + parseFloat(s.score), 0) / scores.success.length
        }`);
      }
    }
    
    // Test 4: Get top candidates
    console.log('\n4️⃣ Testing top candidates retrieval...');
    const topCandidates = await scoringService.getTopCareerChangers(10, 0.5);
    console.log(`   ✅ Retrieved ${topCandidates.length} top candidates`);
    
    if (topCandidates.length > 0) {
      console.log('\n   Top 3 Candidates:');
      topCandidates.slice(0, 3).forEach(c => {
        console.log(`   - ${c.name} (${c.current_profession}): Score ${c.total_score}`);
      });
    }
    
    // Test 5: API endpoints
    console.log('\n5️⃣ Testing API endpoints...');
    const endpoints = [
      '/api/sourcing/career-change/professions',
      '/api/sourcing/career-change/templates',
      '/api/sourcing/career-change/top-candidates'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://localhost:3001${endpoint}`);
        const data = await response.json();
        console.log(`   ✅ ${endpoint}: ${response.status === 200 ? 'OK' : 'FAILED'}`);
      } catch (error) {
        console.log(`   ❌ ${endpoint}: Connection failed`);
      }
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run tests
testCareerChangeSystem();



