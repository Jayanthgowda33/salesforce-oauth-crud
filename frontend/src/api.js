import axios from "axios";

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true, // send the session cookie
});

export const login = () => {
  window.location.href = `${BACKEND_URL}/auth/login`;
};

export const logout = async () => {
  await api.post("/auth/logout");
  window.location.href = "/";
};

export const checkAuth = () => api.get("/auth/me").then((r) => r.data.loggedIn);

export const getFields = (objectName) =>
  api.get(`/api/objects/${objectName}/fields`).then((r) => r.data.fields);

export const getRecords = (objectName, offset = 0) =>
  api.get(`/api/objects/${objectName}/records`, { params: { offset } }).then((r) => r.data);

export const createRecord = (objectName, payload) =>
  api.post(`/api/objects/${objectName}/records`, payload).then((r) => r.data);

export const updateRecord = (objectName, id, payload) =>
  api.patch(`/api/objects/${objectName}/records/${id}`, payload).then((r) => r.data);

export const deleteRecord = (objectName, id) =>
  api.delete(`/api/objects/${objectName}/records/${id}`).then((r) => r.data);
