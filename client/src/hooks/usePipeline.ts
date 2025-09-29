import { useEffect } from 'react';
import { useStore } from '../store';

export const usePipeline = () => {
  const pipelineStages = useStore((state) => state.pipelineStages);
  const candidates = useStore((state) => state.candidates);
  const ui = useStore((state) => state.ui);
  const fetchPipelineStages = useStore((state) => state.fetchPipelineStages);
  const moveCandidateToPipeline = useStore((state) => state.moveCandidateToPipeline);
  const getCandidatesByStage = useStore((state) => state.getCandidatesByStage);
  const getStageStats = useStore((state) => state.getStageStats);

  useEffect(() => {
    fetchPipelineStages();
  }, [fetchPipelineStages]);

  return {
    stages: pipelineStages,
    loading: ui.isLoading,
    error: ui.error,
    moveCandidateToPipeline,
    getCandidatesByStage,
    getStageStats,
    refetch: fetchPipelineStages,
  };
};
