import axios, { AxiosHeaders } from 'axios';
import { useAuthStore } from '../store/authStore';

const client = axios.create({
  baseURL: '/api'
});

client.interceptors.request.use((config) => {
  const { teacherToken, studentToken } = useAuthStore.getState();
  const token = teacherToken ?? studentToken;
  if (token) {
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }

    if (config.headers instanceof AxiosHeaders) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default client;
