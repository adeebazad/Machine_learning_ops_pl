// Runtime configuration
// window.env is injected by env-config.js at runtime (from deploy_unified.sh)

declare global {
    interface Window {
        env?: {
            PEARL_PORT?: string;
            APP_PORT?: string;
        };
    }
}

export const getPearlApiUrl = () => {
    // Current host (IP or Domain)
    const host = window.location.hostname;

    // Get Port:
    // 1. Runtime config (Deployment)
    // 2. Fallback hardcoded (Dev/Default)
    const port = window.env?.PEARL_PORT || '8000';

    // If we are developing locally (localhost), we might assume 8000.
    // But in deployment, pearl is on its own port.

    return `http://${host}:${port}/ollama/ask`;
};
