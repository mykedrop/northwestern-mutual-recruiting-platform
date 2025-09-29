import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  Target,
  Building2,
  Search,
  Filter,
  UserPlus,
  Mail,
  Linkedin,
  Star
} from 'lucide-react';

const SourcingDashboard = () => {
  const [activeTab, setActiveTab] = useState('premium-search');
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');

  // Mock data for Northwestern Mutual
  const activeSeekers = [
    { id: 1, name: 'Sarah Johnson', title: 'Sales Rep', location: 'Milwaukee, WI', match: 92 },
    { id: 2, name: 'Michael Chen', title: 'Account Manager', location: 'Chicago, IL', match: 88 },
    { id: 3, name: 'Jessica Rodriguez', title: 'Customer Success', location: 'Madison, WI', match: 85 }
  ];

  const savedCandidates = [
    { id: 1, name: 'David Park', title: 'Financial Analyst', location: 'Milwaukee, WI', status: 'contacted' },
    { id: 2, name: 'Amanda Foster', title: 'Relationship Manager', location: 'Green Bay, WI', status: 'interested' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Northwestern Mutual Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-2xl">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">AI-Powered Candidate Sourcing</h1>
              <p className="text-blue-100 mt-2">Northwestern Mutual · Premium Recruiting Intelligence</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-200">Recruitment Dashboard</div>
              <div className="text-xl font-semibold">Advanced Sourcing Platform</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Executive Intelligence Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Active Job Seekers */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Active Seekers</div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">{activeSeekers.length}</div>
                  <div className="text-xs text-gray-500 mt-1">Job Change Signals</div>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Saved Prospects */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-2 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Saved Prospects</div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">{savedCandidates.length}</div>
                  <div className="text-xs text-gray-500 mt-1">Ready for Outreach</div>
                </div>
                <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg">
                  <Target className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Intelligence Score */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
            <div className="bg-gradient-to-r from-green-500 to-green-600 h-2 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">AI Match Score</div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">94%</div>
                  <div className="text-xs text-gray-500 mt-1">Avg Quality Score</div>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Search Interface */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 mb-8 border border-blue-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Search className="h-6 w-6 mr-3 text-blue-600" />
            Premium LinkedIn Search
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., Financial Advisor, Sales Representative"
                className="search-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="search-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Milwaukee, WI"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button className="search-button w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center" data-testid="search-button">
                <Search className="h-5 w-5 mr-2" />
                Search LinkedIn
              </button>
            </div>
          </div>

          {/* Popular Search Tags */}
          <div className="filters search-filters flex flex-wrap gap-2" data-testid="filters">
            {['Financial Advisor', 'Account Manager', 'Sales Representative', 'Customer Success', 'Relationship Manager'].map((tag) => (
              <button
                key={tag}
                className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Active Job Seekers Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-600" />
              Active Job Seekers ({activeSeekers.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeSeekers.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {candidate.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{candidate.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{candidate.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-400 mr-1" />
                        <span className="text-sm font-medium text-gray-900">{candidate.match}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button className="text-blue-600 hover:text-blue-900 transition-colors">
                        <Linkedin className="h-4 w-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-900 transition-colors">
                        <Mail className="h-4 w-4" />
                      </button>
                      <button className="text-purple-600 hover:text-purple-900 transition-colors">
                        <UserPlus className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Saved Prospects */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Target className="h-5 w-5 mr-2 text-yellow-600" />
              Saved Prospects ({savedCandidates.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {savedCandidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                          {candidate.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{candidate.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{candidate.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        candidate.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                        candidate.status === 'interested' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {candidate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button className="text-blue-600 hover:text-blue-900 transition-colors">
                        <Linkedin className="h-4 w-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-900 transition-colors">
                        <Mail className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SourcingDashboard;