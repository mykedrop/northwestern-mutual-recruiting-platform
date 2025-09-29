import React, { useState, useRef } from 'react';
import { useCandidates } from '../hooks/useCandidates';
import { useNotifications } from '../hooks/useNotifications';
import { CandidateCardSkeleton, ButtonLoader } from '../components/LoadingStates';
import { useStore } from '../store';
import axios from 'axios';

const CandidatesPage = () => {
  const {
    candidates,
    loading,
    error,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    importCandidate,
    bulkImportCandidates,
  } = useCandidates();
  
  const { success, error: showError } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [intelligenceReport, setIntelligenceReport] = useState<any>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const { ui, setSearchQuery, setFilter } = useStore();

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    
    try {
      if (files.length === 1) {
        await importCandidate(files[0]);
        success('Candidate imported successfully!');
      } else {
        await bulkImportCandidates(Array.from(files));
        success(`${files.length} candidates imported successfully!`);
      }
    } catch (err) {
      showError('Failed to import candidates');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddCandidate = async () => {
    const newCandidate = {
      name: prompt('Candidate name:') || '',
      email: prompt('Candidate email:') || '',
      phone: prompt('Candidate phone:') || '',
      pipelineStage: 'sourced',
    };

    if (newCandidate.name && newCandidate.email) {
      await addCandidate(newCandidate);
    }
  };

  const handleUpdateCandidate = async (id: string) => {
    const updates = {
      name: prompt('New name:') || undefined,
    };

    if (updates.name) {
      await updateCandidate(id, updates);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    if (confirm('Are you sure you want to delete this candidate?')) {
      await deleteCandidate(id);
    }
  };

  const handleViewReport = async (candidate: any) => {
    setSelectedCandidate(candidate);
    setIsLoadingReport(true);

    try {
      // Get the assessment for this candidate
      const assessmentResponse = await axios.get(`http://localhost:3001/api/assessment/by-candidate/${candidate.id}`);
      const assessment = assessmentResponse.data;

      if (!assessment || !assessment.id) {
        throw new Error('No assessment found for this candidate');
      }

      // Get the intelligence report using the assessment ID
      const response = await axios.get(`http://localhost:3001/api/assessment/intelligence/${assessment.id}`);
      setIntelligenceReport(response.data);
    } catch (error) {
      console.error('Failed to fetch intelligence report:', error);
      showError('Failed to load intelligence report. This candidate may not have completed an assessment yet.');
    } finally {
      setIsLoadingReport(false);
    }
  };

  const closeReportModal = () => {
    setSelectedCandidate(null);
    setIntelligenceReport(null);
    setIsLoadingReport(false);
  };

  const getMBTIExplanation = (mbtiType: string): string => {
    const explanations: Record<string, string> = {
      'INTJ': 'Strategic thinker with strong analytical skills. Excels at long-term planning and independent work. May need support in building client relationships.',
      'ENTJ': 'Natural leader with strong business acumen. Direct communicator who drives results. Excellent for leadership roles.',
      'INFJ': 'Empathetic advisor who builds deep client relationships. Strong values-driven decision making. Ideal for client-facing advisory roles.',
      'ENFJ': 'Charismatic communicator who inspires others. Natural mentor and team builder. Excels in relationship-building and training.',
      'INTP': 'Analytical problem-solver who excels at complex financial modeling. May need coaching on client communication.',
      'ENTP': 'Creative strategist who thrives on innovation. Strong persuasion skills. Excellent for business development.',
      'INFP': 'Values-driven professional focused on helping clients achieve goals. Strong ethical compass. Ideal for holistic financial planning.',
      'ENFP': 'Enthusiastic relationship builder with strong communication skills. Creative problem-solver. Great for client acquisition.',
      'ISTJ': 'Reliable and detail-oriented. Excels at process adherence and compliance. Strong fit for operational excellence.',
      'ESTJ': 'Organized leader who drives efficiency. Results-focused with strong management skills. Ideal for team leadership.',
      'ISFJ': 'Dependable support professional who prioritizes client needs. Strong service orientation. Excellent for client retention.',
      'ESFJ': 'People-focused professional who builds strong communities. Natural networker. Great for relationship management.',
      'ISTP': 'Pragmatic problem-solver who adapts quickly. Independent worker. Good for analytical roles.',
      'ESTP': 'Action-oriented professional who thrives under pressure. Strong negotiation skills. Excellent for sales.',
      'ISFP': 'Compassionate advisor who values authentic relationships. Client-centered approach. Good for personalized planning.',
      'ESFP': 'Energetic communicator who engages clients effectively. Spontaneous and adaptable. Strong for client engagement.'
    };
    return explanations[mbtiType] || '';
  };

  const getDISCExplanation = (discType: string): string => {
    const explanations: Record<string, string> = {
      'D': 'Dominant (D) - Results-driven and decisive. Takes charge of situations and drives toward goals. Excellent for leadership and competitive sales roles.',
      'I': 'Influential (I) - Enthusiastic and persuasive. Builds relationships easily and motivates others. Perfect for client acquisition and networking.',
      'S': 'Steady (S) - Patient and supportive. Provides consistent service and builds long-term relationships. Ideal for client retention and team collaboration.',
      'C': 'Conscientious (C) - Analytical and precise. Focuses on accuracy and quality. Excellent for compliance, analysis, and technical roles.',
      'DI': 'Results-oriented influencer who drives outcomes through persuasion. Strong leader and communicator.',
      'DC': 'Decisive analyst who combines drive with precision. Excellent strategic thinker.',
      'IS': 'Supportive influencer who builds strong relationships through consistency. Great team player.',
      'IC': 'Persuasive analyst who balances enthusiasm with detail orientation. Strong consultant profile.',
      'SC': 'Steady perfectionist who delivers reliable, high-quality work. Ideal for operations.',
      'DS': 'Balanced leader who combines decisiveness with collaboration. Strong manager profile.'
    };
    return explanations[discType] || explanations[discType?.charAt(0)] || '';
  };

  const getEnneagramExplanation = (enneagramType: string): string => {
    const typeNum = enneagramType.replace('Type ', '');
    const explanations: Record<string, string> = {
      '1': 'Type 1 (The Reformer) - Principled and ethical. Driven by integrity and doing things right. Excellent attention to detail and high ethical standards.',
      '2': 'Type 2 (The Helper) - Caring and interpersonal. Focuses on relationships and helping others succeed. Natural at building client trust.',
      '3': 'Type 3 (The Achiever) - Success-oriented and driven. Excels at goal achievement and presentation. Strong performer and motivator.',
      '4': 'Type 4 (The Individualist) - Authentic and creative. Brings unique perspective to client relationships. Values meaningful connections.',
      '5': 'Type 5 (The Investigator) - Analytical and insightful. Deep expertise in complex areas. Excellent for technical and strategic roles.',
      '6': 'Type 6 (The Loyalist) - Reliable and security-focused. Strong team player who builds trust. Excellent for long-term client relationships.',
      '7': 'Type 7 (The Enthusiast) - Optimistic and versatile. Brings energy and creativity. Great for innovation and client engagement.',
      '8': 'Type 8 (The Challenger) - Confident and decisive. Natural leader who protects client interests. Strong in negotiations and leadership.',
      '9': 'Type 9 (The Peacemaker) - Diplomatic and supportive. Creates harmony in teams and with clients. Excellent mediator and relationship builder.'
    };
    return explanations[typeNum] || '';
  };

  if (loading && candidates.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Candidates</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <CandidateCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Candidates ({candidates.length})</h1>
        
        <div className="flex gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            multiple
            accept=".pdf,.doc,.docx"
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isImporting ? <ButtonLoader /> : 'Import Resume(s)'}
          </button>
          
          <button
            onClick={handleAddCandidate}
            className="add-candidate px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            data-testid="add-candidate"
          >
            Add Candidate
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search candidates..."
          value={ui.searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">No candidates found</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Import Your First Candidate
          </button>
        </div>
      ) : (
        <div className="candidates-table candidate-list grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {candidates.map((candidate) => {
            const initials = candidate.name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
            const scoreColor = candidate.score >= 70 ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60' :
                             candidate.score >= 50 ? 'bg-amber-50/80 text-amber-700 border-amber-200/60' :
                             'bg-red-50/80 text-red-700 border-red-200/60';
            const scoreBadge = candidate.score >= 70 ? 'STRONG FIT' :
                             candidate.score >= 50 ? 'MODERATE' :
                             'REVIEW';
            const avatarGradient = candidate.score >= 70 ? 'from-emerald-600 to-emerald-800' :
                                 candidate.score >= 50 ? 'from-amber-600 to-amber-800' :
                                 'from-slate-600 to-slate-800';

            return (
              <div
                key={candidate.id}
                className="group bg-white border border-gray-200/80 rounded-lg overflow-hidden hover:border-slate-300 hover:shadow-md transition-all duration-300 relative"
              >
                {/* Status Indicator */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${
                  candidate.score >= 70 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                  candidate.score >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                  'bg-gradient-to-r from-slate-400 to-slate-500'
                }`} />

                {/* Header */}
                <div className="px-3 py-2.5 border-b border-gray-100/80">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-md bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm ring-1 ring-white/20`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate leading-tight">{candidate.name}</h3>
                      {candidate.currentTitle ? (
                        <p className="text-xs text-gray-500 truncate leading-tight mt-0.5">{candidate.currentTitle}</p>
                      ) : (
                        <p className="text-xs text-gray-400 leading-tight mt-0.5">—</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-3 py-2.5 space-y-2">
                  {/* Company */}
                  {candidate.currentCompany && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="font-medium text-gray-700 truncate">{candidate.currentCompany}</span>
                    </div>
                  )}

                  {/* Contact - Condensed */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate text-xs opacity-90">{candidate.email}</span>
                    </div>
                    {candidate.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="text-xs opacity-90">{candidate.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Score Badge */}
                  {candidate.score !== undefined && (
                    <div className={`flex items-center justify-between px-2.5 py-1.5 border rounded-md ${scoreColor} backdrop-blur-sm`}>
                      <span className="text-xs font-bold tracking-tight uppercase">{scoreBadge}</span>
                      <div className="flex items-center gap-1">
                        <div className={`w-1 h-1 rounded-full ${
                          candidate.score >= 70 ? 'bg-emerald-600' :
                          candidate.score >= 50 ? 'bg-amber-600' : 'bg-red-600'
                        }`} />
                        <span className="text-xs font-bold tabular-nums">{candidate.score}%</span>
                      </div>
                    </div>
                  )}

                  {/* Source */}
                  {candidate.source && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-50 text-slate-600 rounded-md border border-slate-200/60">
                        {candidate.source}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-3 py-2 bg-gradient-to-b from-gray-50/50 to-gray-50 border-t border-gray-100/80 flex gap-1.5">
                  <button
                    onClick={() => handleViewReport(candidate)}
                    className="flex-1 px-2.5 py-1.5 bg-slate-800 text-white rounded-md text-xs font-medium hover:bg-slate-900 active:bg-slate-950 transition-colors shadow-sm"
                  >
                    Report
                  </button>
                  <button
                    onClick={() => handleUpdateCandidate(candidate.id)}
                    className="p-1.5 bg-white border border-gray-200/80 text-slate-600 rounded-md hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-all"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteCandidate(candidate.id)}
                    className="p-1.5 bg-white border border-gray-200/80 text-slate-500 rounded-md hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:bg-red-100 transition-all"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Intelligence Report Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">
                  Intelligence Report - {selectedCandidate.name}
                </h2>
                <button
                  onClick={closeReportModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {isLoadingReport ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-lg">Loading intelligence report...</span>
                </div>
              ) : intelligenceReport ? (
                <div className="space-y-6">
                  {/* Overall Assessment */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-xl font-semibold mb-3">Overall Assessment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">
                          {intelligenceReport.overallScore}/100
                        </div>
                        <div className="text-sm text-gray-600">Overall Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">
                          {intelligenceReport.fitScore}/100
                        </div>
                        <div className="text-sm text-gray-600">FA Fit Score</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${
                          intelligenceReport.riskLevel === 'LOW' ? 'text-green-600' :
                          intelligenceReport.riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {intelligenceReport.riskLevel} RISK
                        </div>
                        <div className="text-sm text-gray-600">Risk Level</div>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-white rounded border-l-4 border-blue-500">
                      <div className="font-semibold text-lg">{intelligenceReport.overallAssessment}</div>
                      <div className="text-gray-700 mt-1">Recommendation: {intelligenceReport.recommendation}</div>
                    </div>
                  </div>

                  {/* Personality Profile */}
                  {intelligenceReport.personalityProfile && (
                    <div>
                      <h3 className="text-xl font-semibold mb-4">Personality Profile</h3>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                          <div className="font-bold text-lg text-blue-800 mb-1">{intelligenceReport.personalityProfile.mbti}</div>
                          <div className="text-xs text-gray-600 uppercase tracking-wide">MBTI Type</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                          <div className="font-bold text-lg text-green-800 mb-1">{intelligenceReport.personalityProfile.disc}</div>
                          <div className="text-xs text-gray-600 uppercase tracking-wide">DISC Profile</div>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                          <div className="font-bold text-lg text-purple-800 mb-1">{intelligenceReport.personalityProfile.enneagram}</div>
                          <div className="text-xs text-gray-600 uppercase tracking-wide">Enneagram Type</div>
                        </div>
                      </div>

                      {/* Personality Test Legends */}
                      <div className="bg-gray-50 border border-gray-200 p-5 rounded-lg space-y-4">
                        <h4 className="font-semibold text-md text-gray-800 mb-3">Understanding the Personality Frameworks</h4>

                        {/* MBTI Legend */}
                        <div className="space-y-2">
                          <div className="font-semibold text-blue-700 text-sm">MBTI (Myers-Briggs Type Indicator)</div>
                          <p className="text-sm text-gray-700">A framework measuring four dichotomies: <strong>Extraversion (E)</strong> vs <strong>Introversion (I)</strong>, <strong>Sensing (S)</strong> vs <strong>Intuition (N)</strong>, <strong>Thinking (T)</strong> vs <strong>Feeling (F)</strong>, and <strong>Judging (J)</strong> vs <strong>Perceiving (P)</strong>.</p>
                          {getMBTIExplanation(intelligenceReport.personalityProfile.mbti) && (
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mt-2">
                              <p className="text-sm font-medium text-blue-900">{getMBTIExplanation(intelligenceReport.personalityProfile.mbti)}</p>
                            </div>
                          )}
                        </div>

                        {/* DISC Legend */}
                        <div className="space-y-2">
                          <div className="font-semibold text-green-700 text-sm">DISC Profile</div>
                          <p className="text-sm text-gray-700">Measures behavioral tendencies: <strong>Dominance (D)</strong> - results-oriented, <strong>Influence (I)</strong> - people-oriented, <strong>Steadiness (S)</strong> - stability-focused, <strong>Conscientiousness (C)</strong> - detail-oriented.</p>
                          {getDISCExplanation(intelligenceReport.personalityProfile.disc) && (
                            <div className="bg-green-50 border-l-4 border-green-500 p-3 mt-2">
                              <p className="text-sm font-medium text-green-900">{getDISCExplanation(intelligenceReport.personalityProfile.disc)}</p>
                            </div>
                          )}
                        </div>

                        {/* Enneagram Legend */}
                        <div className="space-y-2">
                          <div className="font-semibold text-purple-700 text-sm">Enneagram</div>
                          <p className="text-sm text-gray-700">A personality system with 9 types, each representing core motivations, fears, and behavioral patterns.</p>
                          {getEnneagramExplanation(intelligenceReport.personalityProfile.enneagram) && (
                            <div className="bg-purple-50 border-l-4 border-purple-500 p-3 mt-2">
                              <p className="text-sm font-medium text-purple-900">{getEnneagramExplanation(intelligenceReport.personalityProfile.enneagram)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Strengths */}
                  {intelligenceReport.strengths && intelligenceReport.strengths.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold mb-3 text-green-700">Key Strengths</h3>
                      <ul className="space-y-2">
                        {intelligenceReport.strengths.map((strength: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="text-green-500 mr-2">✓</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Growth Areas */}
                  {intelligenceReport.growth_areas && intelligenceReport.growth_areas.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold mb-3 text-yellow-700">Growth Areas</h3>
                      <ul className="space-y-2">
                        {intelligenceReport.growth_areas.map((area: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="text-yellow-500 mr-2">→</span>
                            <span>{area}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Behavioral Predictions */}
                  {intelligenceReport.behavioral_predictions && intelligenceReport.behavioral_predictions.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold mb-3">Behavioral Predictions</h3>
                      <ul className="space-y-2">
                        {intelligenceReport.behavioral_predictions.map((prediction: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="text-blue-500 mr-2">•</span>
                            <span>{prediction}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Risk Factors */}
                  {intelligenceReport.risk_factors && intelligenceReport.risk_factors.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold mb-3 text-red-700">Risk Factors</h3>
                      <ul className="space-y-2">
                        {intelligenceReport.risk_factors.map((risk: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="text-red-500 mr-2">⚠</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {intelligenceReport.recommendations && (
                    <div>
                      <h3 className="text-xl font-semibold mb-3">Recommendations</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {intelligenceReport.recommendations.immediate && (
                          <div className="bg-blue-50 p-4 rounded">
                            <h4 className="font-semibold mb-2">Immediate Actions</h4>
                            <ul className="space-y-1 text-sm">
                              {intelligenceReport.recommendations.immediate.map((action: string, index: number) => (
                                <li key={index}>• {action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {intelligenceReport.recommendations.training && (
                          <div className="bg-green-50 p-4 rounded">
                            <h4 className="font-semibold mb-2">Training Needs</h4>
                            <ul className="space-y-1 text-sm">
                              {intelligenceReport.recommendations.training.map((training: string, index: number) => (
                                <li key={index}>• {training}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {intelligenceReport.recommendations.mentoring && (
                          <div className="bg-purple-50 p-4 rounded">
                            <h4 className="font-semibold mb-2">Mentoring</h4>
                            <ul className="space-y-1 text-sm">
                              {intelligenceReport.recommendations.mentoring.map((mentoring: string, index: number) => (
                                <li key={index}>• {mentoring}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">No intelligence report available for this candidate.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidatesPage;
