// src/utils/api.js
import axios from 'axios';

// Automatically points to your Render backend in production, or localhost in development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// 1. Get or create a persistent anonymous user ID in localStorage
export const getAnonymousUserId = () => {
  let userId = localStorage.getItem("anon_user_id");
  if (!userId) {
    // Generates a random string like: user_a89bc34xyz123
    userId = 'user_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("anon_user_id", userId);
  }
  return userId;
};

// 2. Configure a shared Axios client
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// 3. Automatically inject the device ID header into every outgoing request
apiClient.interceptors.request.use((config) => {
  config.headers['x-user-id'] = getAnonymousUserId();
  return config;
});