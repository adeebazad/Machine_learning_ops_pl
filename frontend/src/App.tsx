
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Config } from './pages/Config';
import { CodeStudio } from './pages/CodeStudio';
import { Training } from './pages/Training';
import { Inference } from './pages/Inference';
import { Scheduler } from './pages/Scheduler';
import { ModelRegistry } from './pages/ModelRegistry';
import { NewExperiment } from './pages/NewExperiment';
import Pipelines from './pages/Pipelines';
import PipelineEditor from './pages/PipelineEditor';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/config" element={<Config />} />
          <Route path="/training" element={<Training />} />
          <Route path="/inference" element={<Inference />} />
          <Route path="/code" element={<CodeStudio />} />
          <Route path="/scheduler" element={<Scheduler />} />
          <Route path="/models" element={<ModelRegistry />} />
          <Route path="/experiments/new" element={<NewExperiment />} />
          <Route path="/pipelines" element={<Pipelines />} />
          <Route path="/pipelines/new" element={<PipelineEditor />} />
          <Route path="/pipelines/:id" element={<PipelineEditor />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
