const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:8000/api/sourcing';

async function testTier1Features() {
  console.log('🧪 Testing Tier 1 Features...\n');
  
  console.log('1. Testing LinkedIn Search...');
  const searchResponse = await axios.post(`${API_URL}/search/linkedin`, {
    title: 'financial advisor',
    location: 'milwaukee',
    keywords: ['series 7'],
    limit: 5
  });
  console.log(`   ✅ Found ${searchResponse.data.candidates.length} candidates`);
  
  console.log('\n2. Testing Signal Detection...');
  const signalResponse = await axios.post(`${API_URL}/scan-signals`);
  console.log(`   ✅ Scanned ${signalResponse.data.results.scanned} candidates`);
  console.log(`   ✅ Found ${signalResponse.data.results.signals_found} with signals`);
  
  console.log('\n3. Testing Bulk Actions...');
  const candidateIds = searchResponse.data.candidates.slice(0, 3).map(c => c.id).filter(Boolean);
  
  if (candidateIds.length > 0) {
    const bulkResponse = await axios.post(`${API_URL}/bulk-actions`, {
      action_type: 'bulk-tag',
      candidate_ids: candidateIds,
      parameters: { tags: ['test', 'tier1'] }
    });
    console.log(`   ✅ Bulk action initiated: ${bulkResponse.data.bulkActionId || bulkResponse.data.jobId || 'queued'}`);
  }
  
  console.log('\n✅ All Tier 1 features invoked. Verify DB and logs for details.');
}

testTier1Features().catch((err) => { console.error(err?.response?.data || err.message); process.exit(1); });














