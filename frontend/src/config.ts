/**
 * Centralized API configuration.
 *
 * - In development: set VITE_API_BASE_URL=http://localhost:8000 in frontend/.env
 * - In production (Docker): leave empty — frontend and backend share the same origin.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const API = `${API_BASE_URL}/api`;
