const API_URL = process.env.API_URL || 'http://localhost:3001/api/sourcing';

async function testBulkActions() {
  console.log('🚀 Testing Bulk Actions System...\n');

  console.log('1. Getting sourced candidates...');
  const candidatesResponse = await fetch(`${API_URL}/candidates/sourced?limit=5`);
  const candidatesData = await candidatesResponse.json();

  if (!candidatesData.success || candidatesData.candidates.length === 0) {
    console.log('❌ No candidates found. Please run LinkedIn search first.');
    return;
  }

  const candidateIds = candidatesData.candidates.slice(0, 3).map(c => c.id);
  console.log(`✅ Using candidate IDs: ${candidateIds.join(', ')}`);

  console.log('\n2. Testing bulk tagging...');
  const tagResponse = await fetch(`${API_URL}/bulk-actions/v2/add-tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_ids: candidateIds, tag: 'high_priority' })
  });
  const tagData = await tagResponse.json();
  console.log('Tag job:', tagData);

  if (tagData.success) {
    await new Promise(r => setTimeout(r, 1500));
    const statusResponse = await fetch(`${API_URL}/bulk-actions/status/${tagData.job_id}`);
    const statusData = await statusResponse.json();
    console.log('Status:', statusData);
  }

  console.log('\n3. Testing templates endpoint...');
  const templatesResponse = await fetch(`${API_URL}/bulk-actions/v2/templates?type=email`);
  const templatesData = await templatesResponse.json();
  console.log('Templates length:', templatesData.templates?.length || 0);

  if (templatesData.templates && templatesData.templates.length > 0) {
    console.log('\n4. Testing email personalization...');
    const templateId = templatesData.templates[0].id;
    const emailResponse = await fetch(`${API_URL}/bulk-actions/v2/personalize-emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_ids: candidateIds.slice(0, 2), template_id: templateId })
    });
    const emailData = await emailResponse.json();
    console.log('Email job:', emailData);
  }

  console.log('\n5. Testing LinkedIn connect...');
  const liResponse = await fetch(`${API_URL}/bulk-actions/v2/linkedin-connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_ids: candidateIds.slice(0, 2) })
  });
  const liData = await liResponse.json();
  console.log('LinkedIn job:', liData);

  console.log('\n✨ Bulk actions testing complete!');
}

testBulkActions().catch(console.error);


