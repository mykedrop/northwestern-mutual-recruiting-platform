import React, { useState, useEffect } from 'react';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  position: string;
  performance_rating: string;
  success_level: string;
  assessment_count: string;
  last_assessment_date: string | null;
}

interface ComparisonBaseline {
  id: string;
  comparison_name: string;
  description: string;
  baseline_count: number;
  created_by_name: string;
  created_at: string;
}

interface ComparisonResult {
  overallSimilarity: number;
  fitRecommendation: string;
  confidenceLevel: number;
  dimensionSimilarityScores: Record<string, any>;
  baselineInfo: {
    comparisonName: string;
    baselineAssessmentCount: number;
  };
}

const EmployeeAssessments: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [baselines, setBaselines] = useState<ComparisonBaseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBaseline, setSelectedBaseline] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [activeTab, setActiveTab] = useState<'employees' | 'baselines' | 'comparison'>('employees');

  useEffect(() => {
    fetchEmployees();
    fetchBaselines();
  }, []);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/employee-assessments/employees', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBaselines = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/employee-assessments/baselines', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBaselines(data);
      }
    } catch (error) {
      console.error('Failed to fetch baselines:', error);
    }
  };

  const startEmployeeAssessment = async (employeeId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/employee-assessments/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ employeeId })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Assessment started for ${data.employee.name}. Assessment ID: ${data.assessmentId}`);
        fetchEmployees();
      }
    } catch (error) {
      console.error('Failed to start assessment:', error);
    }
  };

  const createBaseline = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/employee-assessments/baselines', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comparisonName: 'Top Sales Performers',
          description: 'Baseline from high-performing sales team members',
          employeeGroupCriteria: {
            department: 'Sales',
            success_level: 'high_performer',
            performance_rating: { min: 4.5 }
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Baseline created successfully with ${data.baselineAssessmentCount} assessments`);
        fetchBaselines();
      }
    } catch (error) {
      console.error('Failed to create baseline:', error);
    }
  };

  const compareToCandidates = async () => {
    if (!selectedBaseline) {
      alert('Please select a baseline for comparison');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const candidateId = '57f30890-b18e-437b-8a2d-d948da22eb21';

      const response = await fetch('/api/employee-assessments/compare', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          candidateId,
          comparisonId: selectedBaseline
        })
      });

      if (response.ok) {
        const data = await response.json();
        setComparisonResult(data);
      }
    } catch (error) {
      console.error('Failed to compare candidate:', error);
    }
  };

  const getSuccessLevelColor = (level: string) => {
    switch (level) {
      case 'high_performer': return 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs';
      case 'average_performer': return 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs';
      case 'low_performer': return 'bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs';
      default: return 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs';
    }
  };

  const getFitRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'strong_fit': return 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs';
      case 'moderate_fit': return 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs';
      case 'poor_fit': return 'bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs';
      default: return 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs';
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading employees...</div>;
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employee Assessment System</h1>
          <p className="text-gray-600 mt-1">Compare candidate assessments to high-performing employees</p>
        </div>
        <button
          onClick={createBaseline}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Create Sales Baseline
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white rounded-lg">
        <nav className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('employees')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'employees'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            👥 Employees
          </button>
          <button
            onClick={() => setActiveTab('baselines')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'baselines'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🎯 Comparison Baselines
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'comparison'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Candidate Comparison
          </button>
        </nav>
      </div>

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">🏢 Northwestern Mutual Employees</h2>
          </div>
          <div className="p-6 space-y-4">
            {employees.map((employee) => (
              <div key={employee.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {employee.first_name} {employee.last_name} ({employee.employee_id})
                    </h3>
                    <p className="text-sm text-gray-600">
                      {employee.position} • {employee.department}
                    </p>
                    <p className="text-sm text-gray-500">{employee.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={getSuccessLevelColor(employee.success_level)}>
                      {employee.success_level.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      Rating: {parseFloat(employee.performance_rating).toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-sm text-gray-600">
                    Assessments: {employee.assessment_count}
                    {employee.last_assessment_date && (
                      <span className="ml-2">
                        Last: {new Date(employee.last_assessment_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => startEmployeeAssessment(employee.id)}
                    disabled={parseInt(employee.assessment_count) > 0}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      parseInt(employee.assessment_count) > 0
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {parseInt(employee.assessment_count) > 0 ? 'Assessment Completed' : 'Start Assessment'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Baselines Tab */}
      {activeTab === 'baselines' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Comparison Baselines</h2>
          </div>
          <div className="p-6 space-y-4">
            {baselines.map((baseline) => (
              <div key={baseline.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{baseline.comparison_name}</h3>
                    <p className="text-sm text-gray-600">{baseline.description}</p>
                  </div>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    {baseline.baseline_count || 0} assessments
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  Created by {baseline.created_by_name} on{' '}
                  {new Date(baseline.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Tab */}
      {activeTab === 'comparison' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Compare Candidate to Employee Baseline</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Baseline:</label>
              <select
                value={selectedBaseline}
                onChange={(e) => setSelectedBaseline(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a baseline...</option>
                {baselines.filter(b => b.baseline_count > 0).map((baseline) => (
                  <option key={baseline.id} value={baseline.id}>
                    {baseline.comparison_name} ({baseline.baseline_count} assessments)
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={compareToCandidates}
              disabled={!selectedBaseline}
              className={`px-6 py-3 rounded-lg font-medium ${
                selectedBaseline
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Compare Sample Candidate (Tyler Brooks)
            </button>

            {comparisonResult && (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {comparisonResult.overallSimilarity.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Overall Similarity</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="flex justify-center">
                      <span className={getFitRecommendationColor(comparisonResult.fitRecommendation)}>
                        {comparisonResult.fitRecommendation.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Fit Recommendation</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {(comparisonResult.confidenceLevel * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-gray-600">Confidence</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Dimension Analysis</h3>
                  <div className="space-y-3">
                    {Object.entries(comparisonResult.dimensionSimilarityScores).map(([dimension, data]: [string, any]) => (
                      <div key={dimension} className="flex items-center justify-between border-b border-gray-200 pb-2">
                        <div>
                          <span className="font-medium capitalize text-gray-900">
                            {dimension.replace('_', ' ')}
                          </span>
                          <span className="text-sm text-gray-500 ml-2">
                            (maps to {data.mappedTo.replace('_', ' ')})
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">
                            {data.candidateScore} vs {data.baselineAverage.toFixed(1)}
                          </span>
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            {data.similarity.toFixed(1)}% match
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAssessments;