// frontend/js/api.js
// Centralized API client with proper token handling and error management

const API_URL = 'http://localhost:5000/api';

const api = {
  // Helper to get auth header
  getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },

  // Helper to make API requests with auth and error handling
  async request(endpoint, options = {}) {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      }
    };

    const mergedOptions = { ...defaultOptions, ...options };

    try {
      const res = await fetch(`${API_URL}${endpoint}`, mergedOptions);
      const data = await res.json();

      if (res.status === 401) {
        // Clear auth data and redirect to login
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`API request to ${endpoint} failed:`, error);
      throw error;
    }
  },

  // Authentication
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data && data.token && data.user) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },

  async register(name, email, password, role) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role })
    });

    if (data && data.token && data.user) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },

  // Startup endpoints
  async createStartup(startupData) {
    return this.request('/startups', {
      method: 'POST',
      body: JSON.stringify(startupData)
    });
  },

  async getStartup() {
    try {
      const res = await fetch(`${API_URL}/startups/my-startup`, {
        headers: this.getAuthHeader()
      });
      if (res.status === 404) return null;
      const data = await res.json();
      if (res.ok) return data;
      throw new Error(data.message || 'Failed to fetch startup');
    } catch (error) {
      console.error('Get startup error:', error);
      throw error;
    }
  },

  async updateMilestone(startupId, milestoneId, isCompleted) {
    return this.request(`/startups/${startupId}/milestones`, {
      method: 'PUT',
      body: JSON.stringify({ milestoneId, isCompleted })
    });
  },

  async getValidatedStartups() {
    return this.request('/startups/validated');
  },

  // Provider endpoints
  async getMyRequests() {
    return this.request('/providers/my-requests');
  },

  async updateIntroRequest(requestId, newStatus) {
    return this.request(`/providers/requests/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
  }
};

// Expose globally
window.api = api;