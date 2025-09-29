import React, { useState } from 'react';
import { useCandidates } from '../hooks/useCandidates';
import { useNotifications } from '../hooks/useNotifications';

const AssessmentsPage = () => {
  const { candidates } = useCandidates();
  const { success, error } = useNotifications();
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

  // Filter candidates who have assessments
  const candidatesWithAssessments = candidates.filter(candidate =>
    candidate.assessments && candidate.assessments.length > 0
  );

  const handleCreateAssessment = () => {
    // Placeholder for creating new assessment
    const candidateId = prompt('Enter candidate ID for new assessment:');
    if (candidateId) {
      success('Assessment creation functionality coming soon!');
    }
  };

  const handleViewAssessment = (candidate: any) => {
    setSelectedCandidate(candidate);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Assessments ({candidatesWithAssessments.length})</h1>

        <button
          onClick={handleCreateAssessment}
          className="create-assessment px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          data-testid="create-assessment"
        >
          Create Assessment
        </button>
      </div>

      {candidatesWithAssessments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">No assessments found</p>
          <button
            onClick={handleCreateAssessment}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create First Assessment
          </button>
        </div>
      ) : (
        <div className="assessments-list assessments-table bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Candidate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assessment Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {candidatesWithAssessments.map((candidate) =>
                candidate.assessments.map((assessment: any) => (
                  <tr key={`${candidate.id}-${assessment.id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {candidate.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                          <div className="text-sm text-gray-500">{candidate.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assessment.type || 'Behavioral Assessment'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        assessment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        assessment.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {assessment.status || 'completed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assessment.score || candidate.score || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {assessment.completedAt ? new Date(assessment.completedAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleViewAssessment(candidate)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                      <button className="text-green-600 hover:text-green-900">
                        Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Assessment Details Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">
                  Assessment Details - {selectedCandidate.name}
                </h2>
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Candidate Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><strong>Name:</strong> {selectedCandidate.name}</p>
                      <p><strong>Email:</strong> {selectedCandidate.email}</p>
                    </div>
                    <div>
                      <p><strong>Phone:</strong> {selectedCandidate.phone}</p>
                      <p><strong>Stage:</strong> {selectedCandidate.pipelineStage}</p>
                    </div>
                  </div>
                </div>

                {selectedCandidate.assessments && selectedCandidate.assessments.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Assessment Results</h3>
                    {selectedCandidate.assessments.map((assessment: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p><strong>Type:</strong> {assessment.type || 'Behavioral Assessment'}</p>
                            <p><strong>Status:</strong> {assessment.status || 'completed'}</p>
                          </div>
                          <div>
                            <p><strong>Overall Score:</strong> {assessment.score || selectedCandidate.score || 'N/A'}</p>
                            <p><strong>Completed:</strong> {assessment.completedAt ? new Date(assessment.completedAt).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>

                        {assessment.personalityProfile && (
                          <div className="mt-4">
                            <h4 className="font-semibold mb-3 text-blue-700">Personality Framework Scores</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {assessment.personalityProfile.mbti && (
                                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                  <div className="text-xs text-gray-600 mb-1">MBTI Type</div>
                                  <div className="text-lg font-bold text-blue-700">{assessment.personalityProfile.mbti}</div>
                                </div>
                              )}
                              {assessment.personalityProfile.disc && (
                                <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                                  <div className="text-xs text-gray-600 mb-1">DISC Profile</div>
                                  <div className="text-lg font-bold text-green-700">{assessment.personalityProfile.disc}</div>
                                </div>
                              )}
                              {assessment.personalityProfile.enneagram && (
                                <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                                  <div className="text-xs text-gray-600 mb-1">Enneagram Type</div>
                                  <div className="text-lg font-bold text-purple-700">{assessment.personalityProfile.enneagram}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {assessment.dimensionScores && (
                          <div className="mt-6">
                            <h4 className="font-semibold mb-4 text-gray-800">12 Behavioral Dimensions</h4>
                            <div className="space-y-3">
                              {Object.entries(assessment.dimensionScores).map(([dimension, data]: [string, any]) => {
                                const score = data.score || 0;
                                const percentile = data.percentile || 0;
                                const dimensionName = dimension
                                  .split('_')
                                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                  .join(' ');

                                const scoreColor = score >= 80 ? 'bg-green-500' :
                                                 score >= 60 ? 'bg-blue-500' :
                                                 score >= 40 ? 'bg-yellow-500' : 'bg-red-500';

                                return (
                                  <div key={dimension} className="bg-gray-50 p-3 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-sm font-medium text-gray-700">{dimensionName}</span>
                                      <div className="text-right">
                                        <span className="text-lg font-bold text-gray-900">{score}</span>
                                        <span className="text-sm text-gray-500">/100</span>
                                        <span className="text-xs text-gray-500 ml-2">({percentile}th percentile)</span>
                                      </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`${scoreColor} h-2 rounded-full transition-all duration-300`}
                                        style={{ width: `${score}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentsPage;