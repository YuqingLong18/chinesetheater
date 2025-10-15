import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const client = axios.create({
  baseURL: '/api'
});

client.interceptors.request.use((config) => {
  const { teacherToken, studentToken } = useAuthStore.getState();
  const token = teacherToken ?? studentToken;
  if (token) {
    // eslint-disable-next-line no-param-reassign
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`
    };
  }
  return config;
});

export default client;
