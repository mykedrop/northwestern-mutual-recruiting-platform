import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';
import { useStore } from './store';
import { useAuthStore } from './store/authStore';
import { wsService } from './services/websocket';

// Import your existing page components
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Candidates from './pages/Candidates';
import Pipeline from './pages/Pipeline';
import AIDashboard from './pages/AIDashboard';
import Analytics from './pages/Analytics';
import Assessment from './pages/Assessment';
import Assessments from './pages/Assessments';
import SourcingDashboard from './pages/SourcingDashboard';
import Settings from './pages/Settings';
import EmployeeAssessments from './components/EmployeeAssessments';
import AssessmentQuestionsSummary from './components/AssessmentQuestionsSummary';

function App() {
  const { fetchCandidates, fetchPipelineStages, fetchAssessments } = useStore();
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    // Check authentication first
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Initialize app data only if authenticated
    if (isAuthenticated) {
      const initializeApp = async () => {
        try {
          await Promise.all([
            fetchCandidates(),
            fetchPipelineStages(),
            fetchAssessments(),
          ]);
        } catch (error) {
          console.error('Failed to initialize app data:', error);
        }
      };

      initializeApp();

      // Connect WebSocket
      wsService.connect();

      // Cleanup
      return () => {
        wsService.disconnect();
      };
    }
  }, [isAuthenticated, fetchCandidates, fetchPipelineStages, fetchAssessments]);

  return (
    <ErrorBoundary>
      <Router>
        <ToastProvider />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Navigation />
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Navigation />
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/candidates" element={
            <ProtectedRoute>
              <Navigation />
              <Candidates />
            </ProtectedRoute>
          } />
          <Route path="/pipeline" element={
            <ProtectedRoute>
              <Navigation />
              <Pipeline />
            </ProtectedRoute>
          } />
          <Route path="/ai-dashboard" element={
            <ProtectedRoute>
              <Navigation />
              <AIDashboard />
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <Navigation />
              <Analytics />
            </ProtectedRoute>
          } />
          <Route path="/assessments" element={
            <ProtectedRoute>
              <Navigation />
              <Assessments />
            </ProtectedRoute>
          } />
          <Route path="/assessment/:candidateId" element={
            <ProtectedRoute>
              <Navigation />
              <Assessment />
            </ProtectedRoute>
          } />
          <Route path="/sourcing" element={
            <ProtectedRoute>
              <Navigation />
              <SourcingDashboard />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Navigation />
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/employee-assessments" element={
            <ProtectedRoute>
              <Navigation />
              <EmployeeAssessments />
            </ProtectedRoute>
          } />
          <Route path="/assessment-questions" element={
            <ProtectedRoute>
              <Navigation />
              <AssessmentQuestionsSummary />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
