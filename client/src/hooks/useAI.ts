import { useStore } from '../store';

export const useAI = () => {
  const {
    generateAIInsights,
    parseResume,
    ui,
  } = useStore();

  return {
    generateInsights: generateAIInsights,
    parseResume,
    loading: ui.isLoading,
    error: ui.error,
  };
};
