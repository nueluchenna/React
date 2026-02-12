import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically add JWT token to protected requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- API Methods mapped to Ilia's Documentation ---

export const authAPI = {
  login: (credentials) => api.post('/login', credentials), // Section 4.1.2
  register: (userData) => api.post('/users/create', userData), // Section 4.1.1
};

export const questionAPI = {
  submit: (questionData) => api.post('/questions/', questionData), // Section 4.2.1
  getAll: () => api.get('/editor/questions'), // Section 4.2.2
};

export const articleAPI = {
  getPublished: (params) => api.get('/articles/', { params }), // Section 4.4.1
  getSingle: (id) => api.get(`/articles/${id}`), // Section 4.4.2
  // Protected Editor Actions
  create: (data) => api.post('/editor/articles/create', data),
  delete: (id) => api.delete(`/editor/articles/${id}`),
};

export default api;