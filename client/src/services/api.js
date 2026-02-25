import axios from 'axios';

const api = axios.create({
    baseURL: '/api'
});

// Interceptor: tự động gắn token vào mọi request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('nas_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor: xử lý lỗi 401 (token hết hạn) → redirect về login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('nas_token');
            localStorage.removeItem('nas_user');
            // Chỉ redirect nếu không phải đang ở trang login
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
