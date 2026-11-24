import api from "./api";

export const getLocations = () => api.get("/locations").then((r) => r.data);
export const createLocation = (d) => api.post("/locations", d).then((r) => r.data);
export const updateLocation = (id, d) => api.put(`/locations/${id}`, d).then((r) => r.data);
export const deleteLocation = (id) => api.delete(`/locations/${id}`).then((r) => r.data);
export const resolveLink = (url) => api.get("/resolve", { params: { url } }).then((r) => r.data);