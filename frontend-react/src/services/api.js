import axios from 'axios';

// Use relative path in dev so Vite proxy handles CORS.
// In production VITE_API_URL is set to https://api.dolphinorg.in/api
const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_URL,
  // 15s is enough for normal API calls. Upload routes set their own timeout.
  // 30s was masking slow endpoints — fail fast, let users retry.
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ─── In-flight request deduplication ─────────────────────────────────────────
// Prevents duplicate GET requests when multiple components mount simultaneously
// and call the same endpoint (e.g., Header + Dashboard both calling /auth/profile).
// Only GET requests are deduplicated — mutations are always sent.
const inFlight = new Map(); // key: url+params → Promise

function dedupGet(url, config = {}) {
  const key = url + JSON.stringify(config.params || {});
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = api.get(url, config).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

// ─── Request interceptor: attach Bearer token ──────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response interceptor: unwrap data, normalise errors ──────────────────────
// IMPORTANT: We do NOT redirect on 401 here.
// AuthContext.refreshProfile() handles 401 → clearAuth.
api.interceptors.response.use(
  (res) => res.data,
  (error) => {
    // AbortError — request was intentionally cancelled; don't show error toast
    if (axios.isCancel(error)) {
      const cancelled = new Error('Request cancelled');
      cancelled.cancelled = true;
      return Promise.reject(cancelled);
    }
    const data   = error.response?.data;
    const status = error.response?.status;
    const err    = new Error(data?.message || error.message || `HTTP ${status}`);
    err.status   = status;
    err.data     = data;
    return Promise.reject(err);
  }
);

// ─── AUTH ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: async (email, password) => api.post('/auth/login', { email, password }),
  register: async (name, email, password, role) => api.post('/auth/register', { name, email, password, role }),
  logout: async () => api.post('/auth/logout'),
  // dedupGet: multiple components calling getProfile simultaneously get one request
  getProfile: async () => {
    const res = await dedupGet('/auth/profile');
    return res.profile || res;
  },
  forgotPassword: async (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: async (token, password) => api.post(`/auth/reset-password/${token}`, { password }),
  resendOtp: async (email) => api.post('/auth/resend-otp', { email }),
  deleteAccount: async () => api.delete('/auth/account'),
  uploadProfilePicture: async (formData) => api.post('/auth/upload-profile-picture', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }),
  updateProfile: async (name) => api.put('/auth/profile', { name }),
  updatePassword: async (currentPassword, newPassword) => api.put('/auth/password', { currentPassword, newPassword }),
};

// ─── POSTS ─────────────────────────────────────────────────────────────────────
export const postsAPI = {
  // dedupGet: tab switches and StrictMode double-mount won't fire duplicate feed requests
  getFeed: async (filter = 'all', page = 1, limit = 20) =>
    dedupGet('/posts/feed', { params: { filter, page, limit } }),

  // Get today's post usage (how many posts remain)
  getDailyLimit: async () => api.get('/posts/daily-limit'),

  // Get a Cloudinary-signed upload credential (no binary data sent to our server)
  getUploadSignature: async () => api.get('/posts/upload-signature'),

  createPost: async (content, postType, tags, uploadedMedia = []) => {
    // Media files are already uploaded to Cloudinary directly from the browser.
    // We only send the resulting URLs/metadata as JSON — no binary data through our server.
    return api.post('/posts', {
      content: content || '',
      postType: postType || 'general',
      tags: tags || [],
      media: uploadedMedia,   // array of { url, publicId, type, width, height }
    });
  },

  toggleLike: async (postId) => api.post(`/posts/${postId}/like`),
  // view tracking is fire-and-forget, no dedup needed
  trackView: async (postId) => api.post(`/posts/${postId}/view`).catch(() => {}),
  deletePost: async (postId) => api.delete(`/posts/${postId}`),
};

// ─── FOUNDER ───────────────────────────────────────────────────────────────────
export const founderAPI = {
  getMyStartup: async () => {
    try {
      return await api.get('/founder/my-startup');
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },
  getStartup: async () => founderAPI.getMyStartup(),
  createStartup: async (data) => api.post('/founder', data),
  updateStartup: async (data) => api.put('/founder/my-startup', data),

  getStageQuestions: async (stageKey) => api.get(`/founder/validate-stage/${stageKey}/questions`),
  submitStageValidation: async (stageKey, answers) => api.post(
    `/founder/validate-stage/${stageKey}`,
    { answers },
    { timeout: 60000 } // 60s — Gemini batch call can take up to 30s
  ),

  getInvestors: async (search = '', sort = '') => {
    const params = {};
    if (search) params.search = search;
    if (sort) params.sort = sort;
    const data = await api.get('/founder/investors', { params });
    return Array.isArray(data) ? data : [];
  },
  getInvestorDetail: async (id) => api.get(`/founder/investors/${id}`),

  getProviders: async (search = '', category = '') => {
    const params = {};
    if (search) params.search = search;
    if (category && category !== 'all') params.category = category;
    const data = await api.get('/founder/providers', { params });
    return Array.isArray(data) ? data : [];
  },
  getProviderDetail: async (id) => api.get(`/founder/providers/${id}`),

  getAnalytics: async () => api.get('/founder/analytics'),
  getRoadmap: async () => api.get('/founder/roadmap'),
  completeRoadmapTask: async (taskKey) => api.post('/founder/roadmap/complete', { taskKey }),

  sendRequest: async (providerId, message) => api.post('/founder/send-request', { providerId, message }),

  getIncomingRequests: async () => {
    const data = await api.get('/founder/requests');
    return Array.isArray(data) ? data : [];
  },
  getSentRequests: async () => {
    const data = await api.get('/founder/requests/sent');
    return Array.isArray(data) ? data : [];
  },
  acceptRequest: async (id) => api.put(`/founder/requests/${id}/accept`),
  rejectRequest: async (id) => api.put(`/founder/requests/${id}/reject`),

  rateProfile: async (targetUserId, score, comment) => api.post('/founder/rate', { targetUserId, score, comment }),
};

// ─── INVESTOR ──────────────────────────────────────────────────────────────────
export const investorAPI = {
  getValidatedStartups: async () => {
    const data = await dedupGet('/investor/validated-startups');
    return Array.isArray(data) ? data : (data.startups || []);
  },
  getWatchlist: async () => {
    const data = await dedupGet('/investor/watchlist');
    return Array.isArray(data) ? data : [];
  },
  addToWatchlist: async (startupId) => api.post('/investor/watchlist', { startupId }),
  removeFromWatchlist: async (startupId) => api.delete(`/investor/watchlist/${startupId}`),
  expressInterest: async (startupId) => api.post('/investor/express-interest', { startupId }),
  getMyRequests: async () => {
    const data = await dedupGet('/investor/my-requests');
    return Array.isArray(data) ? data : (data.requests || []);
  },
};

// ─── PROVIDER ──────────────────────────────────────────────────────────────────
export const providerAPI = {
  getEligibleFounders: async () => {
    const data = await api.get('/provider/eligible-founders');
    return Array.isArray(data) ? data : (data.founders || []);
  },
  sendProviderRequest: async (startupId, message, servicesOffered) =>
    api.post('/provider/send-request', { startupId, message, servicesOffered }),
  updateIntroRequest: async (requestId, status) =>
    api.put(`/provider/requests/${requestId}`, { status }),
  getMyProfile: async () => {
    const data = await api.get('/provider/profile');
    return data.profile || data;
  },
  updateMyProfile: async (profileData) =>
    api.put('/provider/profile', profileData),
  getMyRequests: async () => {
    const data = await api.get('/provider/my-requests');
    return Array.isArray(data) ? data : (data.requests || []);
  },
};

// ─── ADMIN ─────────────────────────────────────────────────────────────────────
export const adminAPI = {
  getUsers: async () => api.get('/admin/users'),
  approveUser: async (userId) => api.post('/admin/approve-user', { userId }),
  rejectUser: async (userId) => api.post('/admin/reject-user', { userId }),
  moveStage: async (userId) => api.post('/admin/move-stage', { userId }),
  blockUser: async (userId) => api.post('/admin/block-user', { userId }),
};

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────
export const notificationsAPI = {
  getNotifications: async () => {
    const data = await api.get('/notifications');
    return Array.isArray(data) ? data : (data.notifications || []);
  },
  markAllRead: async () => api.put('/notifications/read-all'),
  clearNotifications: async () => api.delete('/notifications/clear'),
};

// ─── CONNECTIONS ───────────────────────────────────────────────────────────────
export const connectionsAPI = {
  sendConnectionRequest: async (toUserId) => api.post('/connections/request', { toUserId }),
  getConnections: async () => api.get('/connections'),
  getStatus: async (userId) => api.get(`/connections/status/${userId}`),
  updateConnection: async (id, status) => api.put(`/connections/${id}`, { status }),
  getPendingCount: async () => api.get('/connections/pending-count'),
};

// ─── GAMIFICATION ──────────────────────────────────────────────────────────────
export const gamificationAPI = {
  getMyStats:    async () => api.get('/gamification/me'),
  recordLogin:   async () => api.post('/gamification/activity'),
  getLeaderboard: async (role) => api.get(`/gamification/leaderboard/${role}`),
  getLeaderboardProfile: async (userId) => api.get(`/gamification/profile/${userId}`),
  claimReward:   async (milestone, fullName, phone, address) =>
    api.post('/gamification/claim-reward', { milestone, fullName, phone, address }),
};

// ─── CHAT ──────────────────────────────────────────────────────────────────────
export const chatAPI = {
  getConversations: async () => {
    const data = await api.get('/chat/conversations');
    return Array.isArray(data) ? data : [];
  },
  getMessages: async (partnerId) => {
    const data = await api.get(`/chat/${partnerId}`);
    return Array.isArray(data) ? data : [];
  },
  sendMessage: async (receiverId, content) => api.post('/chat/send', { receiverId, content }),
  getUserProfile: async (userId) => api.get(`/chat/user/${userId}`),
  reactToMessage: async (messageId, emoji) => api.post(`/chat/${messageId}/react`, { emoji }),
  deleteForEveryone: async (messageId) => api.delete(`/chat/${messageId}`),
  // Bulk check online status for a list of user IDs
  getOnlineStatus: async (userIds) => api.post('/chat/online-status', { userIds }),
};

// ─── VERIFICATION ──────────────────────────────────────────────────────────────
export const verificationAPI = {
  createOrder: async (fullName, phone, email) =>
    api.post('/verification/create-order', { fullName, phone, email }),
  getStatus: async () => api.get('/verification/status'),
  // Actively checks Cashfree order status and activates badge if paid
  refreshStatus: async (orderId) =>
    api.get('/verification/refresh-status', { params: { order_id: orderId } }),
};

// ─── RESOURCES ─────────────────────────────────────────────────────────────────
export const resourcesAPI = {
  getResources: async () => api.get('/resources'),
};
export default {
  getProfile: authAPI.getProfile,
  getStartup: founderAPI.getStartup,
  createStartup: founderAPI.createStartup,
  updateStartup: founderAPI.updateStartup,
  updateProfile: authAPI.updateProfile,
  updatePassword: authAPI.updatePassword,
  uploadProfilePicture: authAPI.uploadProfilePicture,
  deleteAccount: authAPI.deleteAccount,
  getRoadmap: founderAPI.getRoadmap,
  completeRoadmapTask: founderAPI.completeRoadmapTask,
  request: founderAPI.request,
};
