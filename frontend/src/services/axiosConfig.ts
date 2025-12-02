import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8001',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.response.use(
    (response) => response.data,
    (error) => Promise.reject(error)
);

export default api;
