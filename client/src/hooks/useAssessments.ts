import { useEffect } from 'react';
import { useStore } from '../store';

export const useAssessments = () => {
  const {
    assessments,
    fetchAssessments,
    createAssessment,
    updateAssessment,
    ui,
  } = useStore();

  useEffect(() => {
    fetchAssessments();
  }, []);

  return {
    assessments: Object.values(assessments),
    assessmentsMap: assessments,
    loading: ui.isLoading,
    error: ui.error,
    createAssessment,
    updateAssessment,
    refetch: fetchAssessments,
  };
};
