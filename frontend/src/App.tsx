
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import DashboardBuilder from './pages/DashboardBuilder';
import EmbedDashboard from './pages/EmbedDashboard';

import { CodeStudio } from './pages/CodeStudio';
import { Training } from './pages/Training';
import { Inference } from './pages/Inference';

import { NewExperiment } from './pages/NewExperiment';
import Pipelines from './pages/Pipelines';
import PipelineEditor from './pages/PipelineEditor';
import StandAloneAnalytics from './pages/StandAloneAnalytics';
import RouteRegistry from './pages/RouteRegistry';

const App: React.FC = () => {
  // CRITICAL: Block access on port 3000 (raw container)
  if (window.location.port === '3000') {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: '#050505',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '1rem' }}>⚠️ WRONG PORT DETECTED</h1>
        <p style={{ fontSize: '1.2rem', color: '#9ca3af', maxWidth: '600px' }}>
          You are accessing the frontend via <strong>Port 3000</strong>. This bypasses the API proxy.
        </p>
        <div style={{ margin: '2rem 0', padding: '1.5rem', border: '1px solid #3b82f6', borderRadius: '0.5rem', backgroundColor: 'rgba(59,130,246,0.1)' }}>
          <p style={{ marginBottom: '0.5rem' }}>Please access the application via <strong>Port 80</strong> instead:</p>
          <a
            href={`http://${window.location.hostname}`}
            style={{ color: '#60a5fa', fontSize: '1.5rem', fontWeight: 'bold', textDecoration: 'underline' }}
          >
            http://{window.location.hostname}
          </a>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone Route (No Layout) */}
        <Route path="/dashboard/analytics" element={<StandAloneAnalytics />} />

        {/* Main App Routes (Wrapped in Layout) */}
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />

              <Route path="/training" element={<Training />} />
              <Route path="/inference" element={<Inference />} />
              <Route path="/code" element={<CodeStudio />} />

              <Route path="/experiments/new" element={<NewExperiment />} />
              <Route path="/pipelines" element={<Pipelines />} />
              <Route path="/pipelines/new" element={<PipelineEditor />} />
              <Route path="/pipelines/:id" element={<PipelineEditor />} />
              <Route path="/dashboards" element={<DashboardBuilder />} />
              <Route path="/routes" element={<RouteRegistry />} />
            </Routes>
          </Layout>
        } />
        <Route path="/shared/dashboard/:uuid" element={<EmbedDashboard />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
