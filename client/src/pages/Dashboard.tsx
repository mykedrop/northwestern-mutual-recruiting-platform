import React from 'react';
import { useCandidates } from '../hooks/useCandidates';
import { usePipeline } from '../hooks/usePipeline';

const Dashboard = () => {
  const { candidates, getTotalCandidates } = useCandidates();
  const { getStageStats } = usePipeline();
  const stats = getStageStats();

  // Professional Northwestern Mutual metrics
  const totalCandidates = getTotalCandidates();
  const activeCandidates = candidates.filter(c => c.status === 'active').length;
  const completedAssessments = candidates.filter(c => c.assessments && c.assessments.length > 0).length;
  const aiInsights = candidates.filter(c => c.aiInsights).length;

  // Advanced metrics for Fortune 100 presentation
  const assessmentCompletionRate = totalCandidates > 0 ? Math.round((completedAssessments / totalCandidates) * 100) : 0;
  const avgCandidateScore = totalCandidates > 0 ? Math.round(candidates.reduce((sum, c) => sum + (c.score || 0), 0) / totalCandidates) : 0;
  const topPerformers = candidates.filter(c => (c.score || 0) >= 90).length;

  return (
    <div className="dashboard min-h-screen bg-gradient-to-br from-nm-blue-50 via-white to-nm-blue-50" data-testid="dashboard-content">
      {/* Northwestern Mutual Header */}
      <div className="bg-gradient-to-r from-nm-blue-500 to-nm-blue-600 text-white shadow-2xl">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Recruiting Intelligence Dashboard</h1>
              <p className="text-nm-blue-100 mt-1">Northwestern Mutual • Advanced Candidate Analytics</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-nm-blue-600 px-4 py-2 rounded-lg shadow-md">
                <div className="text-xs text-nm-blue-200">Last Updated</div>
                <div className="text-sm font-semibold">Just now</div>
              </div>
              <div className="bg-green-600 px-4 py-2 rounded-lg shadow-md">
                <div className="text-xs text-green-100">System Status</div>
                <div className="text-sm font-semibold">All Systems Operational</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Talent Pool */}
          <div className="metric-card dashboard-card bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 h-2"></div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Talent Pool</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{totalCandidates}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm">
                  <span className="text-green-600 font-medium">↗ +12%</span>
                  <span className="text-gray-500 ml-2">vs. last month</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Pipeline */}
          <div className="metric-card dashboard-card bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="bg-gradient-to-r from-green-600 to-green-700 h-2"></div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Active Pipeline</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{activeCandidates}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm">
                  <span className="text-green-600 font-medium">Strong performance</span>
                </div>
              </div>
            </div>
          </div>

          {/* Assessment Completion */}
          <div className="metric-card dashboard-card bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 h-2"></div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Assessment Rate</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{assessmentCompletionRate}%</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm">
                  <span className="text-purple-600 font-medium">{completedAssessments} completed</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Intelligence */}
          <div className="metric-card dashboard-card bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 h-2"></div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">AI Intelligence</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{aiInsights}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm">
                  <span className="text-orange-600 font-medium">Insights generated</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Pipeline Health */}
          <div className="pipeline-health lg:col-span-2 bg-white rounded-xl shadow-lg border border-gray-100 p-6" data-testid="pipeline-health">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Pipeline Health Analytics</h2>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Real-time</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4">
              {Object.entries(stats).map(([stageId, count], index) => {
                const stageColors = ['bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-green-500', 'bg-emerald-500'];
                const stageLabels = ['New Leads', 'Assessment', 'Interview', 'Offer', 'Hired'];

                return (
                  <div key={stageId} className="text-center">
                    <div className={`${stageColors[index]} text-white rounded-lg p-4 mb-2 shadow-lg hover:shadow-xl transition-all duration-300`}>
                      <div className="text-3xl font-bold">{count}</div>
                      <div className="text-sm opacity-90">{stageLabels[index] || stageId}</div>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full mt-2">
                      <div
                        className={`h-full ${stageColors[index]} rounded-full`}
                        style={{ width: `${Math.max(10, (count / Math.max(...Object.values(stats))) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Performance Metrics</h2>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">Average Score</span>
                  <span className="text-2xl font-bold text-blue-600">{avgCandidateScore}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${avgCandidateScore}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">Top Performers</span>
                  <span className="text-2xl font-bold text-green-600">{topPerformers}</span>
                </div>
                <div className="text-xs text-gray-500">Candidates scoring 90+</div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">Completion Rate</span>
                  <span className="text-2xl font-bold text-purple-600">{assessmentCompletionRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-purple-600 h-3 rounded-full" style={{ width: `${assessmentCompletionRate}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">3 new candidates added to pipeline</p>
                <p className="text-sm text-gray-500">2 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Assessment completed by John Smith</p>
                <p className="text-sm text-gray-500">15 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 p-4 bg-purple-50 rounded-lg">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">AI analysis generated for 2 candidates</p>
                <p className="text-sm text-gray-500">1 hour ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
