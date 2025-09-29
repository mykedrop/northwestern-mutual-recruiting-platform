import { useEffect } from 'react';
import { useStore } from '../store';
import { wsService } from '../services/websocket';

export const useCandidates = () => {
  const {
    candidates,
    fetchCandidates,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    importCandidate,
    bulkImportCandidates,
    getCandidateById,
    getCandidatesByStage,
    getFilteredCandidates,
    getTotalCandidates,
    ui,
  } = useStore();

  useEffect(() => {
    // Initial fetch
    fetchCandidates();

    // Setup WebSocket connection
    wsService.connect();

    // Cleanup
    return () => {
      wsService.disconnect();
    };
  }, []);

  return {
    candidates: Object.values(candidates),
    candidatesMap: candidates,
    loading: ui.isLoading,
    error: ui.error,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    importCandidate,
    bulkImportCandidates,
    getCandidateById,
    getCandidatesByStage,
    getFilteredCandidates,
    getTotalCandidates,
    refetch: fetchCandidates,
  };
};
