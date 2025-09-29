const axios = require('axios');

async function run() {
  const baseURL = 'http://localhost:3001/api/v3/ai';
  const token = process.env.TEST_TOKEN || '';

  const queries = [
    'How many candidates do we have?',
    'Which candidates are the strongest based on assessments?',
    'What is the current pipeline status?',
  ];

  for (const q of queries) {
    try {
      const res = await axios.post(`${baseURL}/chatbot/message`, {
        message: q,
        sessionId: 'test_' + Date.now()
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      console.log('Q:', q);
      console.log('A:', (res.data.response || '').slice(0, 200));
    } catch (e) {
      console.log('Error:', e.response?.data || e.message);
    }
  }
}

run();


