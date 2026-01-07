# MLOps Platform Frontend

The frontend is a modern Single Page Application (SPA) built with **React**, **TypeScript**, and **Vite**. It provides a comprehensive dashboard for managing the ML lifecycle.

## 💻 Tech Stack

*   **Framework**: React 18+
*   **Build Tool**: Vite
*   **Styling**: TailwindCSS
*   **Routing**: React Router DOM v6
*   **Visualization**: Recharts, React Flow (for pipeline editing)

## 🗂️ Project Structure

The source code is located in `frontend/src`:

*   `components/`: Reusable UI components (Layout, AnalyticsEngine, etc.).
*   `pages/`: Main views corresponding to routes (Dashboard, Training, Pipelines).
*   `services/`: API client wrappers (axios).
*   `utils/`: Helper functions.

## 🧭 Key Components & Pages

### 1. Dashboard (`src/pages/Dashboard.tsx`)
The landing page providing high-level metrics on model performance, recent runs, and resource usage.

### 2. Pipeline Editor (`src/pages/PipelineEditor.tsx`)
A visual drag-and-drop editor for constructing ML pipelines.
*   **Features**: Add steps (Extraction, Preprocessing, Training), configure parameters, and connect nodes.
*   **Tech**: Uses `reactflow` for the node graph.

### 3. Analytics Engine (`src/components/analytics/AnalyticsEngine.tsx` & `src/pages/StandAloneAnalytics.tsx`)
A dedicated module for analyzing datasets and model outputs.
*   **Capabilities**:
    *   Dynamic Charting (Bar, Line, Scatter).
    *   Correlation Matrices.
    *   Data Grids.

### 4. Code Studio (`src/pages/CodeStudio.tsx`)
An embedded IDE-like environment for viewing or editing scripts directly from the browser.

## 🚦 Routing (`App.tsx`)

| Route | Page | Description |
| :--- | :--- | :--- |
| `/` | Dashboard | Main overview |
| `/pipelines` | Pipelines | List of pipelines |
| `/pipelines/:id` | PipelineEditor | Edit logical flow |
| `/dashboard/analytics`| StandAloneAnalytics | Fullscreen analytics view |

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev
```

> [!IMPORTANT]
> The frontend is configured to run behind an Nginx proxy in production. Ensure you access it via the configured port (usually 80 or 8080) to avoid CORS issues with the backend.
