import api from './axiosConfig';

export const systemService = {
    getStats: () => {
        // WebSockets are handled separately, this is a placeholder if we add REST endpoints
        return api.get('/system/stats');
    }
};

export const configService = {
    list: () => api.get('/config/list'),
    get: (filename: string) => api.get(`/config/${filename}`),
    save: (filename: string, content: any) => api.post(`/config/${filename}`, { content }),
    create: (name: string, content: any) => api.post('/config/create/new', { name, content }),
    delete: (filename: string) => api.delete(`/config/${filename}`),
};

export const databaseService = {
    test: (config: any) => api.post('/database/test', config),
    getColumns: (table: string, config: any) => api.post(`/database/columns/${table}`, config),
    getRowCount: (table: string, config: any) => api.post(`/database/count/${table}`, config),
};

export const fileService = {
    read: (path: string) => api.get(`/files/read?path=${path}`),
    save: (path: string, content: string) => api.post('/files/save', { path, content }),
    run: (path: string) => api.post('/files/run', { path, content: '' }),
    list: () => api.get('/files/list'),
};

export const trainingService = {
    train: (configId: number) => api.post('/train', { config_id: configId }),
};

export const inferenceService = {
    predict: (data: any[], modelUri?: string, configId?: number, daysToPredict?: number) =>
        api.post('/predict', { data, model_uri: modelUri, config_id: configId, days_to_predict: daysToPredict }),
};

export const schedulerService = {
    getJobs: () => api.get('/scheduler/jobs'),
    start: (configPath: string, time: string) => api.post('/scheduler/start', { config_path: configPath, time }),
    stop: (jobId: number) => api.post(`/scheduler/stop/${jobId}`),
    clear: () => api.post('/scheduler/clear'),
};

export const mlflowService = {
    listExperiments: () => api.get('/mlflow/experiments'),
    listRuns: (experimentId: string) => api.get(`/mlflow/runs/${experimentId}`),
};

export const experimentService = {
    list: () => api.get('/experiments/'),
    create: (name: string, description?: string) => api.post('/experiments/', { name, description }),
    get: (id: number) => api.get(`/experiments/${id}`),
    listConfigs: (experimentId: number) => api.get(`/experiments/${experimentId}/configs`),
    createConfig: (experimentId: number, name: string, configJson: any) => api.post(`/experiments/${experimentId}/configs`, { name, config_json: configJson }),
    updateConfig: (configId: number, name: string, configJson: any) => api.put(`/experiments/configs/${configId}`, { name, config_json: configJson }),
    getConfig: (configId: number) => api.get(`/experiments/configs/${configId}`),
    listJobs: (experimentId: number) => api.get(`/experiments/${experimentId}/jobs`),
};

export const pipelineService = {
    listPipelines: () => api.get('/pipelines/'),
    getPipeline: (id: number) => api.get(`/pipelines/${id}`),
    createPipeline: (pipelineData: any) => api.post('/pipelines/', pipelineData),
    deletePipeline: (id: number) => api.delete(`/pipelines/${id}`),
    updatePipeline: (id: number, data: any) => api.put(`/pipelines/${id}`, data),
    runPipeline: (id: number) => api.post(`/pipelines/${id}/run`),
    listPipelineRuns: (id: number) => api.get(`/pipelines/${id}/runs`),
    testStep: (id: number, order: number, stepDef?: any) => api.post(`/pipelines/${id}/steps/${order}/test`, stepDef),
};
