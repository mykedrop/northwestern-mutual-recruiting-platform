import React, { useState, useEffect } from 'react';

interface QuestionOption {
  value: number;
  label: string;
  description: string;
}

interface Question {
  id: string;
  dimension: string;
  type: string;
  question: string;
  description: string;
  options: QuestionOption[] | any;
  scoring: string;
  timeEstimate: string;
}

interface Dimension {
  name: string;
  description: string;
  weight: number;
  faWeight: number;
  questions: string[];
  keywords: string[];
}

interface AssessmentData {
  metadata: {
    totalQuestions: number;
    dimensions: number;
    estimatedTime: string;
    scoringMethod: string;
  };
  dimensions: { [key: string]: Dimension };
  questions: Question[];
}

const AssessmentQuestionsSummary: React.FC = () => {
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDimension, setSelectedDimension] = useState<string>('all');
  const [selectedQuestionType, setSelectedQuestionType] = useState<string>('all');

  useEffect(() => {
    fetchAssessmentQuestions();
  }, []);

  const fetchAssessmentQuestions = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/assessment-questions', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAssessmentData(data);
      }
    } catch (error) {
      console.error('Failed to fetch assessment questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQuestionTypeColor = (type: string) => {
    switch (type) {
      case 'likert_scale': return 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs';
      case 'scenario_choice': return 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs';
      case 'priority_ranking': return 'bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs';
      case 'matrix_grid': return 'bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs';
      default: return 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs';
    }
  };

  const getDimensionColor = (dimension: string) => {
    const colors = {
      'achievementDrive': 'bg-red-50 border-red-200',
      'clientFocus': 'bg-blue-50 border-blue-200',
      'resilience': 'bg-green-50 border-green-200',
      'communicationSkills': 'bg-yellow-50 border-yellow-200',
      'learningAgility': 'bg-purple-50 border-purple-200',
      'collaboration': 'bg-indigo-50 border-indigo-200'
    };
    return colors[dimension as keyof typeof colors] || 'bg-gray-50 border-gray-200';
  };

  const filteredQuestions = assessmentData?.questions.filter(q => {
    const dimensionMatch = selectedDimension === 'all' || q.dimension === selectedDimension;
    const typeMatch = selectedQuestionType === 'all' || q.type === selectedQuestionType;
    return dimensionMatch && typeMatch;
  }) || [];

  const uniqueQuestionTypes = [...new Set(assessmentData?.questions.map(q => q.type) || [])];

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading assessment questions...</div>;
  }

  if (!assessmentData) {
    return <div className="text-center text-red-600">Failed to load assessment questions</div>;
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📋 Assessment Questions Summary</h1>
            <p className="text-gray-600 mt-1">Northwestern Mutual Behavioral Assessment - Detailed Question Review</p>
          </div>
        </div>

        {/* Metadata Overview */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{assessmentData.metadata.totalQuestions}</div>
            <div className="text-sm text-blue-800">Total Questions</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{assessmentData.metadata.dimensions}</div>
            <div className="text-sm text-green-800">Dimensions</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-600">{assessmentData.metadata.estimatedTime}</div>
            <div className="text-sm text-purple-800">Estimated Time</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <div className="text-lg font-bold text-orange-600">Multi-Dimensional</div>
            <div className="text-sm text-orange-800">Scoring Method</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🔍 Filters</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Dimension:</label>
            <select
              value={selectedDimension}
              onChange={(e) => setSelectedDimension(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Dimensions</option>
              {Object.entries(assessmentData.dimensions).map(([key, dimension]) => (
                <option key={key} value={key}>{dimension.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Question Type:</label>
            <select
              value={selectedQuestionType}
              onChange={(e) => setSelectedQuestionType(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Question Types</option>
              {uniqueQuestionTypes.map(type => (
                <option key={type} value={type}>{type.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dimensions Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Behavioral Dimensions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(assessmentData.dimensions).map(([key, dimension]) => (
            <div key={key} className={`p-4 rounded-lg border-2 ${getDimensionColor(key)}`}>
              <h3 className="font-semibold text-gray-900">{dimension.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{dimension.description}</p>
              <div className="mt-3 space-y-1">
                <div className="text-xs text-gray-500">Weight: {(dimension.weight * 100).toFixed(0)}% | FA Weight: {(dimension.faWeight * 100).toFixed(0)}%</div>
                <div className="text-xs text-gray-500">Questions: {dimension.questions.length}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {dimension.keywords.slice(0, 3).map(keyword => (
                    <span key={keyword} className="bg-white text-gray-700 px-2 py-1 rounded text-xs">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Questions Detail */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          ❓ Question Details ({filteredQuestions.length} questions)
        </h2>

        <div className="space-y-6">
          {filteredQuestions.map((question, index) => {
            const dimension = assessmentData.dimensions[question.dimension];
            return (
              <div key={question.id} className={`border-2 rounded-lg p-6 ${getDimensionColor(question.dimension)}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-lg text-gray-900">Q{index + 1}</span>
                      <span className={getQuestionTypeColor(question.type)}>
                        {question.type.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                        {dimension?.name}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{question.question}</h3>
                    <p className="text-sm text-gray-600 mb-3">{question.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">{question.timeEstimate}</div>
                  </div>
                </div>

                {/* Answer Options */}
                <div className="bg-white rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-3">Answer Options:</h4>
                  {Array.isArray(question.options) ? (
                    <div className="space-y-2">
                      {question.options.map((option: QuestionOption, optIndex: number) => (
                        <div key={optIndex} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                            {option.value}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{option.label}</div>
                            <div className="text-sm text-gray-600">{option.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">Complex question format - see assessment interface for details</div>
                  )}
                </div>

                {/* Scoring Information */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <h4 className="font-medium text-blue-900 mb-1">Scoring Method:</h4>
                  <p className="text-sm text-blue-800">{question.scoring}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📈 Assessment Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {uniqueQuestionTypes.length}
            </div>
            <div className="text-sm text-gray-600">Question Types</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {filteredQuestions.filter(q => q.type === 'likert_scale').length}
            </div>
            <div className="text-sm text-gray-600">Likert Scale</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {filteredQuestions.filter(q => q.type === 'scenario_choice').length}
            </div>
            <div className="text-sm text-gray-600">Scenario Choice</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {filteredQuestions.filter(q => q.type === 'priority_ranking').length}
            </div>
            <div className="text-sm text-gray-600">Priority Ranking</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentQuestionsSummary;