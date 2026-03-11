const API_URL = 'https://dolphin-main-production.up.railway.app/api';

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
      
      // Handle non-JSON responses (like HTML error pages)
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Server returned ${res.status}: ${text.substring(0, 100)}...`);
      }
      
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

  // Startup endpoints - UPDATED to match backend
  async createStartup(startupData) {
    return this.request('/founder', {
      method: 'POST',
      body: JSON.stringify(startupData)
    });
  },

  async getStartup() {
    try {
      const data = await this.request('/founder/my-startup');
      if (data && data.message && data.message.includes('No startup found')) {
        return null;
      }
      return data;
    } catch (error) {
      if (error.message.includes('No startup found')) {
        return null;
      }
      console.error('Get startup error:', error);
      throw error;
    }
  },

  // FIXED: Update milestone endpoint to match backend
  async updateMilestone(milestoneId, isCompleted) {
    return this.request('/founder/milestones', {
      method: 'PUT',
      body: JSON.stringify({ milestoneId, isCompleted })
    });
  },
  async updateStartup(startupData) {
    return this.request('/founder/my-startup', {
      method: 'PUT',
      body: JSON.stringify(startupData)
    });
  },
  async getValidatedStartups() {
    return this.request('/investor/validated-startups');
  },

  // Provider endpoints
  async getEligibleFounders() {
    return this.request('/provider/eligible-founders');
  },
  async getNotifications() {
    return this.request('/notifications');
  },
  async markAllRead() {
    return this.request('/notifications/read-all', {
      method: 'PUT'
    });
  },
  async clearNotifications() {
    return this.request('/notifications/clear', {
      method: 'DELETE'
    });
  },
   async sendProviderRequest(startupId, message, servicesOffered) {
    return this.request('/provider/send-request', {
      method: 'POST',
      body: JSON.stringify({ 
        startupId, 
        message, 
        servicesOffered 
      })
    });
  },
 async sendProviderRequest(startupId, message, servicesOffered) {
    return this.request('/provider/send-request', {
      method: 'POST',
      body: JSON.stringify({ 
        startupId, 
        message, 
        servicesOffered 
      })
    });
  },
  async updateIntroRequest(requestId, newStatus) {
    return this.request(`/provider/requests/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
  },

  // Admin endpoints
  async getUsers() {
    return this.request('/admin/users');
  },

  async approveUser(userId) {
    return this.request('/admin/approve-user', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  async rejectUser(userId) {
    return this.request('/admin/reject-user', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  async moveStage(userId) {
    return this.request('/admin/move-stage', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  async blockUser(userId) {
    return this.request('/admin/block-user', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  // ===== VALIDATION ENDPOINTS =====
  
  async getValidationQuestionnaire() {
    return this.request('/founder/validation/questionnaire');
  },

  async submitValidationResponses(responses) {
    return this.request('/founder/validation/submit', {
      method: 'POST',
      body: JSON.stringify({ responses })
    });
  },

  async getValidationStatus() {
    return this.request('/founder/validation/status');
  },

  // Founder: investors & providers (when validationScore >= 70%)
  async getFounderInvestors() {
    return this.request('/founder/investors');
  },

  async getFounderInvestorDetail(id) {
    return this.request(`/founder/investors/${id}`);
  },

  async getFounderProviders() {
    return this.request('/founder/providers');
  },

  async getFounderProviderDetail(id) {
    return this.request(`/founder/providers/${id}`);
  },

  // Delete account (all roles)
    // Delete account (all roles)
  async deleteAccount() {
    return this.request('/auth/account', { method: 'DELETE' });
  },

  // Analytics endpoints
  async getAnalytics() {
    return this.request('/founder/analytics');
  },

  async getResources() {
    return this.request('/resources');
  },
 // frontend/js/api.js

  // Get Roadmap Tasks
  async getRoadmap() {
    return this.request('/founder/roadmap');
  },

  // Complete Roadmap Task
  async completeRoadmapTask(taskKey) {
    return this.request('/founder/roadmap/complete', {
      method: 'POST',
      body: JSON.stringify({ taskKey })
    });
  },
};

// Expose globally
window.api = api;