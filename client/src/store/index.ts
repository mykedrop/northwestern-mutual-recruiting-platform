import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import api from '../services/api';

// Types
interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  resume?: string;
  pipelineStage: string;
  assessments?: Assessment[];
  aiInsights?: AIInsights;
  createdAt: string;
  updatedAt: string;
  score?: number;
  status: 'active' | 'archived' | 'rejected';
  source?: string;
  notes?: string;
  tags?: string[];
  currentTitle?: string;
  currentCompany?: string;
  headline?: string;
  summary?: string;
}

interface Assessment {
  id: string;
  candidateId: string;
  type: string;
  scores: Record<string, number>;
  completedAt: string;
}

interface AIInsights {
  summary?: string;
  strengths?: string[];
  concerns?: string[];
  recommendations?: string[];
  predictedSuccess?: number;
  retentionProbability?: number;
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  candidates: string[]; // candidate IDs
  color: string;
}

interface UIState {
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  activeModal: string | null;
  selectedCandidates: string[];
  searchQuery: string;
  filterBy: Record<string, any>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface StoreState {
  // Data
  candidates: Record<string, Candidate>;
  pipelineStages: PipelineStage[];
  assessments: Record<string, Assessment>;
  
  // UI State
  ui: UIState;
  
  // Websocket
  isConnected: boolean;
  
  // Actions - Data
  fetchCandidates: () => Promise<void>;
  fetchPipelineStages: () => Promise<void>;
  fetchAssessments: () => Promise<void>;
  addCandidate: (candidate: Partial<Candidate>) => Promise<void>;
  updateCandidate: (id: string, updates: Partial<Candidate>) => Promise<void>;
  deleteCandidate: (id: string) => Promise<void>;
  moveCandidateToPipeline: (candidateId: string, stageId: string) => Promise<void>;
  importCandidate: (file: File) => Promise<void>;
  bulkImportCandidates: (files: File[]) => Promise<void>;
  
  // Actions - Assessments
  createAssessment: (candidateId: string, type: string, data: any) => Promise<void>;
  updateAssessment: (id: string, data: any) => Promise<void>;
  
  // Actions - AI
  generateAIInsights: (candidateId: string) => Promise<void>;
  parseResume: (candidateId: string, file: File) => Promise<void>;
  
  // Actions - UI
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSuccessMessage: (message: string | null) => void;
  setActiveModal: (modal: string | null) => void;
  selectCandidate: (id: string) => void;
  deselectCandidate: (id: string) => void;
  clearSelection: () => void;
  setSearchQuery: (query: string) => void;
  setFilter: (key: string, value: any) => void;
  clearFilters: () => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  
  // Actions - WebSocket
  setConnected: (connected: boolean) => void;
  handleRealtimeUpdate: (type: string, data: any) => void;
  
  // Computed
  getCandidateById: (id: string) => Candidate | undefined;
  getCandidatesByStage: (stageId: string) => Candidate[];
  getFilteredCandidates: () => Candidate[];
  getTotalCandidates: () => number;
  getStageStats: () => Record<string, number>;
}

// API_BASE is now handled by the api service

export const useStore = create<StoreState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial state
          candidates: {},
          pipelineStages: [],
          assessments: {},
          ui: {
            isLoading: false,
            error: null,
            successMessage: null,
            activeModal: null,
            selectedCandidates: [],
            searchQuery: '',
            filterBy: {},
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
          isConnected: false,

          // Data Actions
          fetchCandidates: async () => {
            set((state) => {
              state.ui.isLoading = true;
              state.ui.error = null;
            });

            try {
              console.log('Fetching candidates from API...');

              // Fetch real candidates from the backend API
              const apiCandidates = await api.get('/candidates');

              console.log('API Response:', apiCandidates);

              // Fetch all assessments to get personality data
              const allAssessments = await api.get('/assessment/');

              // Create a map of candidate_id to assessment with personality data
              const assessmentMap = new Map();
              for (const assessment of allAssessments) {
                if (assessment.status === 'completed') {
                  try {
                    const intelligenceData = await api.get(`/assessment/intelligence/${assessment.id}`);
                    assessmentMap.set(assessment.candidate_id, {
                      id: assessment.id,
                      candidateId: assessment.candidate_id,
                      type: 'Behavioral',
                      status: assessment.status,
                      score: intelligenceData.overallScore || 50,
                      personalityProfile: intelligenceData.personalityProfile,
                      dimensionScores: intelligenceData.dimensionScores,
                      completedAt: assessment.completed_at
                    });
                  } catch (err) {
                    console.error(`Failed to fetch intelligence for assessment ${assessment.id}`, err);
                  }
                }
              }

              // Transform API data to frontend format
              const transformedCandidates = apiCandidates.map((candidate: any) => ({
                id: candidate.id,
                name: `${candidate.first_name} ${candidate.last_name}`,
                email: candidate.email,
                phone: candidate.phone || '',
                pipelineStage: candidate.stage_id || null, // Use actual stage_id from database
                status: 'active' as const,
                createdAt: candidate.created_at,
                updatedAt: candidate.updated_at,
                score: candidate.nm_score || 50,
                source: candidate.source || 'Manual',
                currentTitle: candidate.current_title,
                currentCompany: candidate.current_company,
                headline: candidate.headline,
                summary: candidate.summary,
                assessments: assessmentMap.has(candidate.id) ? [assessmentMap.get(candidate.id)] : [],
                aiInsights: {
                  strengths: [],
                  growthAreas: [],
                  recommendations: []
                }
              }));

              set((state) => {
                state.candidates = {};
                transformedCandidates.forEach((candidate: Candidate) => {
                  state.candidates[candidate.id] = candidate;
                });
                state.ui.isLoading = false;
                state.ui.successMessage = `Loaded ${transformedCandidates.length} candidates`;
              });

              // Auto-clear success message
              setTimeout(() => {
                set((state) => {
                  state.ui.successMessage = null;
                });
              }, 3000);
            } catch (error: any) {
              console.error('Failed to fetch candidates:', error);
              set((state) => {
                state.ui.isLoading = false;
                state.ui.error = error.message || 'Failed to fetch candidates';
              });
            }
          },

          fetchPipelineStages: async () => {
            try {
              console.log('Fetching real pipeline stages from API...');

              // Fetch actual pipeline stages from the backend
              const apiStages = await api.get('/pipeline/stages');

              console.log('Pipeline stages from API:', apiStages);

              // Transform API data to frontend format
              const transformedStages = apiStages.map((stage: any) => ({
                id: stage.id,
                name: stage.name,
                order: stage.order_position,
                color: stage.color,
                description: stage.description,
                candidates: [] // Will be populated when candidates are fetched
              }));

              set((state) => {
                state.pipelineStages = transformedStages;
              });

              console.log('Pipeline stages loaded successfully:', transformedStages);
            } catch (error: any) {
              console.error('Failed to fetch pipeline stages:', error);
              set((state) => {
                state.ui.error = error.message || 'Failed to fetch pipeline stages';
              });
            }
          },

          fetchAssessments: async () => {
            try {
              const assessmentsArray = await api.get('/assessments');
              
              set((state) => {
                state.assessments = {};
                assessmentsArray.forEach((assessment: Assessment) => {
                  state.assessments[assessment.id] = assessment;
                });
              });
            } catch (error: any) {
              set((state) => {
                state.ui.error = error.message || 'Failed to fetch assessments';
              });
            }
          },

          addCandidate: async (candidateData) => {
            set((state) => {
              state.ui.isLoading = true;
            });

            try {
              const newCandidate = await api.post('/candidates', candidateData);
              
              set((state) => {
                state.candidates[newCandidate.id] = newCandidate;
                state.ui.isLoading = false;
                state.ui.successMessage = `Added ${newCandidate.name} successfully`;
              });

              // Refresh data to ensure consistency
              get().fetchCandidates();
            } catch (error: any) {
              set((state) => {
                state.ui.isLoading = false;
                state.ui.error = error.message || 'Failed to add candidate';
              });
            }
          },

          updateCandidate: async (id, updates) => {
            // Optimistic update
            set((state) => {
              if (state.candidates[id]) {
                Object.assign(state.candidates[id], updates);
              }
            });

            try {
              const updatedCandidate = await api.put(`/candidates/${id}`, updates);
              
              set((state) => {
                state.candidates[id] = updatedCandidate;
                state.ui.successMessage = 'Candidate updated successfully';
              });
            } catch (error: any) {
              // Revert optimistic update
              get().fetchCandidates();
              
              set((state) => {
                state.ui.error = error.message || 'Failed to update candidate';
              });
            }
          },

          deleteCandidate: async (id) => {
            // Optimistic delete
            const candidateBackup = get().candidates[id];
            
            set((state) => {
              delete state.candidates[id];
            });

            try {
              await api.delete(`/candidates/${id}`);
              
              set((state) => {
                state.ui.successMessage = 'Candidate deleted successfully';
              });
            } catch (error: any) {
              // Revert deletion
              if (candidateBackup) {
                set((state) => {
                  state.candidates[id] = candidateBackup;
                });
              }
              
              set((state) => {
                state.ui.error = error.message || 'Failed to delete candidate';
              });
            }
          },

          moveCandidateToPipeline: async (candidateId, stageId) => {
            // Optimistic update
            set((state) => {
              if (state.candidates[candidateId]) {
                state.candidates[candidateId].pipelineStage = stageId;
              }
            });

            try {
              await api.post('/pipeline/move', {
                candidateId,
                stageId,
              });
              
              set((state) => {
                state.ui.successMessage = 'Candidate moved successfully';
              });

              // Refresh both candidates and pipeline
              get().fetchCandidates();
              get().fetchPipelineStages();
            } catch (error: any) {
              // Revert on error
              get().fetchCandidates();
              
              set((state) => {
                state.ui.error = error.message || 'Failed to move candidate';
              });
            }
          },

          importCandidate: async (file) => {
            set((state) => {
              state.ui.isLoading = true;
              state.ui.successMessage = 'Importing candidate...';
            });

            const formData = new FormData();
            formData.append('resume', file);

            try {
              const importedCandidate = await api.post('/candidates/import', formData, {
                headers: {
                  'Content-Type': 'multipart/form-data',
                },
              });
              
              set((state) => {
                state.candidates[importedCandidate.id] = importedCandidate;
                state.ui.isLoading = false;
                state.ui.successMessage = `Successfully imported ${importedCandidate.name}`;
              });

              // Refresh all data to ensure consistency
              await get().fetchCandidates();
              await get().fetchPipelineStages();
              
            } catch (error: any) {
              set((state) => {
                state.ui.isLoading = false;
                state.ui.error = error.message || 'Failed to import candidate';
              });
            }
          },

          bulkImportCandidates: async (files) => {
            set((state) => {
              state.ui.isLoading = true;
              state.ui.successMessage = `Importing ${files.length} candidates...`;
            });

            const formData = new FormData();
            files.forEach((file) => {
              formData.append('resumes', file);
            });

            try {
              const importedCandidates = await api.post('/candidates/bulk-import', formData, {
                headers: {
                  'Content-Type': 'multipart/form-data',
                },
              });
              
              set((state) => {
                importedCandidates.forEach((candidate: Candidate) => {
                  state.candidates[candidate.id] = candidate;
                });
                state.ui.isLoading = false;
                state.ui.successMessage = `Successfully imported ${importedCandidates.length} candidates`;
              });

              // Refresh all data
              await get().fetchCandidates();
              await get().fetchPipelineStages();
              
            } catch (error: any) {
              set((state) => {
                state.ui.isLoading = false;
                state.ui.error = error.message || 'Failed to import candidates';
              });
            }
          },

          // Assessment Actions
          createAssessment: async (candidateId, type, data) => {
            set((state) => {
              state.ui.isLoading = true;
            });

            try {
              const newAssessment = await api.post('/assessments', {
                candidateId,
                type,
                ...data,
              });
              
              set((state) => {
                state.assessments[newAssessment.id] = newAssessment;
                if (state.candidates[candidateId]) {
                  if (!state.candidates[candidateId].assessments) {
                    state.candidates[candidateId].assessments = [];
                  }
                  state.candidates[candidateId].assessments.push(newAssessment);
                }
                state.ui.isLoading = false;
                state.ui.successMessage = 'Assessment created successfully';
              });

              // Refresh candidate data
              get().fetchCandidates();
            } catch (error: any) {
              set((state) => {
                state.ui.isLoading = false;
                state.ui.error = error.message || 'Failed to create assessment';
              });
            }
          },

          updateAssessment: async (id, data) => {
            try {
              const updatedAssessment = await api.put(`/assessments/${id}`, data);
              
              set((state) => {
                state.assessments[id] = updatedAssessment;
                state.ui.successMessage = 'Assessment updated successfully';
              });
            } catch (error: any) {
              set((state) => {
                state.ui.error = error.message || 'Failed to update assessment';
              });
            }
          },

          // AI Actions
          generateAIInsights: async (candidateId) => {
            set((state) => {
              state.ui.isLoading = true;
              state.ui.successMessage = 'Generating AI insights...';
            });

            try {
              const insights = await api.post(`/ai/insights/${candidateId}`);
              
              set((state) => {
                if (state.candidates[candidateId]) {
                  state.candidates[candidateId].aiInsights = insights;
                }
                state.ui.isLoading = false;
                state.ui.successMessage = 'AI insights generated successfully';
              });
            } catch (error: any) {
              set((state) => {
                state.ui.isLoading = false;
                state.ui.error = error.message || 'Failed to generate AI insights';
              });
            }
          },

          parseResume: async (candidateId, file) => {
            const formData = new FormData();
            formData.append('resume', file);

            try {
              const parsedData = await api.post(
                `/ai/parse-resume/${candidateId}`,
                formData,
                {
                  headers: {
                    'Content-Type': 'multipart/form-data',
                  },
                }
              );
              
              set((state) => {
                if (state.candidates[candidateId]) {
                  Object.assign(state.candidates[candidateId], parsedData);
                }
                state.ui.successMessage = 'Resume parsed successfully';
              });
            } catch (error: any) {
              set((state) => {
                state.ui.error = error.message || 'Failed to parse resume';
              });
            }
          },

          // UI Actions
          setLoading: (isLoading) => set((state) => {
            state.ui.isLoading = isLoading;
          }),

          setError: (error) => set((state) => {
            state.ui.error = error;
          }),

          setSuccessMessage: (message) => set((state) => {
            state.ui.successMessage = message;
          }),

          setActiveModal: (modal) => set((state) => {
            state.ui.activeModal = modal;
          }),

          selectCandidate: (id) => set((state) => {
            if (!state.ui.selectedCandidates.includes(id)) {
              state.ui.selectedCandidates.push(id);
            }
          }),

          deselectCandidate: (id) => set((state) => {
            state.ui.selectedCandidates = state.ui.selectedCandidates.filter(cId => cId !== id);
          }),

          clearSelection: () => set((state) => {
            state.ui.selectedCandidates = [];
          }),

          setSearchQuery: (query) => set((state) => {
            state.ui.searchQuery = query;
          }),

          setFilter: (key, value) => set((state) => {
            state.ui.filterBy[key] = value;
          }),

          clearFilters: () => set((state) => {
            state.ui.filterBy = {};
          }),

          setSorting: (sortBy, sortOrder) => set((state) => {
            state.ui.sortBy = sortBy;
            state.ui.sortOrder = sortOrder;
          }),

          // WebSocket Actions
          setConnected: (connected) => set((state) => {
            state.isConnected = connected;
          }),

          handleRealtimeUpdate: (type, data) => {
            switch (type) {
              case 'candidate:created':
                set((state) => {
                  state.candidates[data.id] = data;
                });
                break;
              case 'candidate:updated':
                set((state) => {
                  if (state.candidates[data.id]) {
                    Object.assign(state.candidates[data.id], data);
                  }
                });
                break;
              case 'candidate:deleted':
                set((state) => {
                  delete state.candidates[data.id];
                });
                break;
              case 'pipeline:moved':
                set((state) => {
                  if (state.candidates[data.candidateId]) {
                    state.candidates[data.candidateId].pipelineStage = data.stageId;
                  }
                });
                break;
              case 'assessment:completed':
                set((state) => {
                  state.assessments[data.id] = data;
                  if (state.candidates[data.candidateId]) {
                    if (!state.candidates[data.candidateId].assessments) {
                      state.candidates[data.candidateId].assessments = [];
                    }
                    state.candidates[data.candidateId].assessments.push(data);
                  }
                });
                break;
            }
          },

          // Computed Getters
          getCandidateById: (id) => get().candidates[id],

          getCandidatesByStage: (stageId) => {
            return Object.values(get().candidates).filter(
              (candidate) => candidate.pipelineStage === stageId
            );
          },

          getFilteredCandidates: () => {
            let candidates = Object.values(get().candidates);
            const { searchQuery, filterBy, sortBy, sortOrder } = get().ui;

            // Apply search
            if (searchQuery) {
              candidates = candidates.filter((candidate) =>
                candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                candidate.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                candidate.phone?.includes(searchQuery)
              );
            }

            // Apply filters
            Object.entries(filterBy).forEach(([key, value]) => {
              if (value !== undefined && value !== '') {
                candidates = candidates.filter((candidate) => {
                  return (candidate as any)[key] === value;
                });
              }
            });

            // Apply sorting
            candidates.sort((a, b) => {
              const aVal = (a as any)[sortBy];
              const bVal = (b as any)[sortBy];
              
              if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
              } else {
                return aVal < bVal ? 1 : -1;
              }
            });

            return candidates;
          },

          getTotalCandidates: () => Object.keys(get().candidates).length,

          getStageStats: () => {
            const stats: Record<string, number> = {};
            get().pipelineStages.forEach((stage) => {
              stats[stage.id] = get().getCandidatesByStage(stage.id).length;
            });
            return stats;
          },
        }))
      ),
      {
        name: 'northwestern-mutual-store',
        partialize: (state) => ({
          candidates: state.candidates,
          pipelineStages: state.pipelineStages,
          assessments: state.assessments,
        }),
      }
    )
  )
);
