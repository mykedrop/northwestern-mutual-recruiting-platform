import React from 'react';
import { useCandidates } from '../hooks/useCandidates';

const Analytics = () => {
  const { candidates } = useCandidates();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Candidate Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{candidates.length}</div>
            <div className="text-gray-600">Total Candidates</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {candidates.filter(c => c.score && c.score > 80).length}
            </div>
            <div className="text-gray-600">High Scoring Candidates</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {candidates.filter(c => c.aiInsights).length}
            </div>
            <div className="text-gray-600">AI Analyzed</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
