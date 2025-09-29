import React from 'react';
import { useParams } from 'react-router-dom';
import { useCandidates } from '../hooks/useCandidates';

const Assessment = () => {
  const { candidateId } = useParams();
  const { getCandidateById } = useCandidates();
  const candidate = candidateId ? getCandidateById(candidateId) : null;

  if (!candidate) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Assessment</h1>
        <div className="text-center py-12">
          <p className="text-gray-600">Candidate not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Assessment for {candidate.name}</h1>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Candidate Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p><strong>Name:</strong> {candidate.name}</p>
            <p><strong>Email:</strong> {candidate.email}</p>
            <p><strong>Phone:</strong> {candidate.phone}</p>
          </div>
          <div>
            <p><strong>Pipeline Stage:</strong> {candidate.pipelineStage}</p>
            <p><strong>Status:</strong> {candidate.status}</p>
            <p><strong>Score:</strong> {candidate.score || 'N/A'}</p>
          </div>
        </div>
        
        {candidate.assessments && candidate.assessments.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Assessments</h3>
            <div className="space-y-3">
              {candidate.assessments.map((assessment) => (
                <div key={assessment.id} className="border rounded p-3">
                  <p><strong>Type:</strong> {assessment.type}</p>
                  <p><strong>Completed:</strong> {new Date(assessment.completedAt).toLocaleDateString()}</p>
                  <div className="mt-2">
                    <strong>Scores:</strong>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {Object.entries(assessment.scores).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          {key}: {value}%
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Assessment;
