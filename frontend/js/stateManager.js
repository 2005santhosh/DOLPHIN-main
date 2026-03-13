// frontend/js/stateManager.js
// Production-grade state management for Phase 1-5 implementation
// Handles state-driven UI rendering, stage gating validation, and visibility/transparency
const API_URL = 'https://dolphinorg.in/api';
class StateManager {
  constructor() {
    this.user = this.getUser();
    this.stateConfig = this.initializeStateConfig();
    this.visibilityRules = this.initializeVisibilityRules();
  }

  /**
   * Phase 1: State-Driven Dashboards
   * Fetch and validate user state from backend on every initialization
   */
  getUser() {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('user');
      return null;
    }
  }

  /**
   * Phase 1: Fetch current state from backend
   * Always trust backend state, never frontend-stored state
   */
  async syncStateWithBackend() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) return false;

      const data = await response.json();

      // `GET /api/auth/profile` returns `{ success, profile: {...} }`.
      // Store the flattened profile shape, because the rest of the frontend expects `user.state`, `user.stage`, etc.
      const profile = data?.profile || data;
      this.user = profile;
      localStorage.setItem('user', JSON.stringify(profile));

      return true;
    } catch (error) {
      console.error('Failed to sync state:', error);
      return false;
    }
  }

  /**
   * State configuration for Phase 1-3
   * Defines allowed transitions and requirements
   */
  initializeStateConfig() {
    return {
      PENDING_APPROVAL: {
        label: 'Pending Approval',
        description: 'Your account is under review',
        allowed_transitions: ['APPROVED', 'BLOCKED'],
        features_available: [],
        icon: '⏳'
      },
      APPROVED: {
        label: 'Approved',
        description: 'Account verified. You can begin validation.',
        allowed_transitions: ['STAGE_1', 'BLOCKED'],
        features_available: ['dashboard', 'profile', 'view_resources'],
        icon: '✅',
        stage: 1
      },
      STAGE_1: {
        label: 'Stage 1: Idea Clarity',
        description: 'Define your core idea and target market',
        allowed_transitions: ['STAGE_2', 'BLOCKED'],
        features_available: ['submit_tasks', 'view_resources', 'browse_providers'],
        icon: '💡',
        stage: 1,
        requirements: ['idea_definition', 'market_research']
      },
      STAGE_2: {
        label: 'Stage 2: Problem Validation',
        description: 'Validate the problem with supporting data',
        allowed_transitions: ['STAGE_3', 'BLOCKED'],
        features_available: ['submit_tasks', 'view_resources', 'browse_providers', 'request_intros'],
        icon: '🔍',
        stage: 2,
        requirements: ['user_interviews', 'problem_validation']
      },
      STAGE_3: {
        label: 'Stage 3: Customer Interviews',
        description: 'Conduct 20+ qualitative interviews',
        allowed_transitions: ['STAGE_4', 'BLOCKED'],
        features_available: ['submit_tasks', 'view_resources', 'request_intros'],
        icon: '👥',
        stage: 3,
        requirements: ['interviews_completed', 'insights_documented']
      },
      STAGE_4: {
        label: 'Stage 4: Solution Fit',
        description: 'Test solution hypotheses',
        allowed_transitions: ['STAGE_5', 'BLOCKED'],
        features_available: ['submit_tasks', 'request_intros', 'analytics'],
        icon: '🎯',
        stage: 4,
        requirements: ['solution_tested', 'fit_validated']
      },
      STAGE_5: {
        label: 'Stage 5: MVP Prototype',
        description: 'Build and test the minimum viable product',
        allowed_transitions: ['STAGE_6', 'BLOCKED'],
        features_available: ['submit_tasks', 'marketplace', 'analytics'],
        icon: '🚀',
        stage: 5,
        requirements: ['mvp_built', 'user_testing_complete']
      },
      STAGE_6: {
        label: 'Stage 6: Traction Metrics',
        description: 'Achieve initial traction (users/revenue)',
        allowed_transitions: ['STAGE_7', 'BLOCKED'],
        features_available: ['submit_tasks', 'marketplace', 'analytics'],
        icon: '📈',
        stage: 6,
        requirements: ['traction_metrics', 'growth_evidence']
      },
      STAGE_7: {
        label: 'Stage 7: Funding Readiness',
        description: 'Finalize pitch deck and financial models',
        allowed_transitions: ['BLOCKED'],
        features_available: ['submit_tasks', 'marketplace', 'analytics'],
        icon: '💰',
        stage: 7,
        requirements: ['pitch_ready', 'financials_ready']
      },
      BLOCKED: {
        label: 'Blocked',
        description: 'Your account has been restricted. Contact support.',
        allowed_transitions: [],
        features_available: [],
        icon: '🚫',
        critical: true
      }
    };
  }

  /**
   * Phase 5: Visibility & Transparency Rules
   * Define why features are disabled and what actions are needed
   */
  initializeVisibilityRules() {
    return {
      submit_tasks: {
        enabled_in_states: ['STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4', 'STAGE_5'],
        disabled_message: 'Task submission is not available in your current state',
        blocked_states: {
          PENDING_APPROVAL: {
            reason: 'Your account is pending admin approval',
            next_steps: 'Wait for admin to review your registration. You\'ll receive an email when approved.',
            estimated_time: '24-48 hours'
          },
          APPROVED: {
            reason: 'You need to complete Stage 1 requirements before submitting tasks',
            next_steps: 'Complete your startup profile and submit Stage 1 materials',
            blocked_by: 'Stage Gating'
          },
          BLOCKED: {
            reason: 'Your account has been blocked',
            next_steps: 'Contact support@dolphin.com for assistance',
            support_priority: 'high'
          }
        }
      },
      marketplace: {
        enabled_in_stages: [2, 3, 4, 5],
        disabled_message: 'Marketplace access is restricted until Stage 2',
        requirements: {
          stage_2: 'Reach Stage 2 to browse service providers',
          validation_score: 'Achieve 50% validation score to access marketplace'
        }
      },
      express_interest: {
        enabled_for_roles: ['investor'],
        disabled_message: 'Only investors can express interest',
        investor_requirements: {
          state: 'APPROVED',
          min_score_to_view: 70
        }
      },
      view_resources: {
        enabled_in_stages: [1, 2, 3, 4, 5],
        resources_by_stage: {
          1: ['Idea Definition Template', 'Market Research Guide'],
          2: ['Interview Script', 'Problem Validation Checklist'],
          3: ['Customer Interview Toolkit', 'Insights Analysis Template'],
          4: ['Solution Testing Framework', 'Fit Validation Metrics'],
          5: ['MVP Checklist', 'Launch Readiness Guide']
        }
      }
    };
  }

  /**
   * Phase 2: Get user access level for admin features
   */
  isAdmin() {
    return this.user && this.user.role === 'investor';
  }

  /**
   * Phase 3: Stage Gating Validation
   * Check if user can access a feature based on state and stage
   */
  canAccessFeature(featureName) {
    if (!this.user) return false;

    const rule = this.visibilityRules[featureName];
    if (!rule) return true; // Feature has no restrictions

    // Check state restrictions
    if (rule.enabled_in_states && !rule.enabled_in_states.includes(this.user.state)) {
      return false;
    }

    // Check stage restrictions
    if (rule.enabled_in_stages && this.user.stage < Math.min(...rule.enabled_in_stages)) {
      return false;
    }

    // Check role restrictions
    if (rule.enabled_for_roles && !rule.enabled_for_roles.includes(this.user.role)) {
      return false;
    }

    return true;
  }

  /**
   * Phase 5: Get detailed reason why feature is blocked
   */
  getBlockReason(featureName) {
    if (!this.user) {
      return {
        blocked: true,
        reason: 'Not authenticated',
        next_steps: 'Please log in to continue',
        can_retry: true
      };
    }

    const rule = this.visibilityRules[featureName];
    if (!rule) return { blocked: false };

    // Check state restrictions
    if (rule.enabled_in_states && !rule.enabled_in_states.includes(this.user.state)) {
      const blockedInfo = rule.blocked_states?.[this.user.state];
      return {
        blocked: true,
        reason: blockedInfo?.reason || `Feature not available in ${this.user.state} state`,
        next_steps: blockedInfo?.next_steps || 'Contact support for assistance',
        estimated_time: blockedInfo?.estimated_time,
        support_priority: blockedInfo?.support_priority
      };
    }

    // Check stage restrictions
    if (rule.enabled_in_stages) {
      const minStage = Math.min(...rule.enabled_in_stages);
      if (this.user.stage < minStage) {
        return {
          blocked: true,
          reason: `${featureName} is available starting at Stage ${minStage}`,
          next_steps: `Complete Stage ${this.user.stage} to unlock this feature`,
          current_progress: `${this.user.stage}/${minStage}`,
          can_retry: false
        };
      }
    }

    // Check role restrictions
    if (rule.enabled_for_roles && !rule.enabled_for_roles.includes(this.user.role)) {
      return {
        blocked: true,
        reason: `This feature is only available for: ${rule.enabled_for_roles.join(', ')}`,
        your_role: this.user.role,
        next_steps: 'Switch roles or contact support if you believe this is an error'
      };
    }

    return { blocked: false };
  }

  /**
   * Phase 1: Dynamically render UI based on state
   */
  renderConditionalUI() {
    if (!this.user) return;

    // Hide/show elements based on state and role
    document.querySelectorAll('[data-require-state]').forEach(el => {
      const requiredStates = el.dataset.requireState.split(',');
      el.style.display = requiredStates.includes(this.user.state) ? '' : 'none';
    });

    document.querySelectorAll('[data-require-stage]').forEach(el => {
      const requiredStage = parseInt(el.dataset.requireStage);
      el.style.display = this.user.stage >= requiredStage ? '' : 'none';
    });

    document.querySelectorAll('[data-require-role]').forEach(el => {
      const requiredRoles = el.dataset.requireRole.split(',');
      el.style.display = requiredRoles.includes(this.user.role) ? '' : 'none';
    });

    // Disable blocked features
    document.querySelectorAll('[data-feature]').forEach(el => {
      const feature = el.dataset.feature;
      if (!this.canAccessFeature(feature)) {
        el.disabled = true;
        el.title = this.getBlockReason(feature).reason;
        el.classList.add('disabled');
      }
    });
  }

  /**
   * Phase 5: Show user-friendly block message with next steps
   */
  showBlockMessage(featureName, containerSelector) {
    const blockReason = this.getBlockReason(featureName);
    if (!blockReason.blocked) return;

    const container = document.querySelector(containerSelector);
    if (!container) return;

    const message = `
      <div class="block-message">
        <div class="block-icon">⚠️</div>
        <div class="block-content">
          <h3>${blockReason.reason}</h3>
          <p>${blockReason.next_steps}</p>
          ${blockReason.estimated_time ? `<p class="hint">⏱️ Estimated: ${blockReason.estimated_time}</p>` : ''}
          ${blockReason.current_progress ? `<p class="hint">📊 Progress: ${blockReason.current_progress}</p>` : ''}
        </div>
      </div>
    `;

    container.innerHTML = message;
    container.classList.add('block-message-container');
  }

  /**
   * Phase 1: Update UI to reflect current state
   */
  displayStateIndicator(containerSelectorOrEl) {
    const container =
      typeof containerSelectorOrEl === 'string'
        ? document.querySelector(containerSelectorOrEl)
        : containerSelectorOrEl;

    if (!container || !this.user) return;

    const stateInfo = this.stateConfig[this.user.state];
    if (!stateInfo) return;

    const indicator = `
      <div class="state-indicator" data-state="${this.user.state}">
        <span class="state-icon">${stateInfo.icon}</span>
        <div class="state-info">
          <div class="state-label">${stateInfo.label}</div>
          <div class="state-description">${stateInfo.description}</div>
        </div>
        ${this.user.stage ? `<div class="stage-badge">Stage ${this.user.stage}</div>` : ''}
      </div>
    `;

    container.innerHTML = indicator;
  }

  /**
   * Phase 3: Get stage information for progress display
   */
  getStageProgress() {
    if (!this.user) return null;

    const stages = [1, 2, 3, 4, 5];
    const completedStages = this.user.stage;
    const totalStages = 5;

    return {
      current: this.user.stage,
      total: totalStages,
      percentage: (completedStages / totalStages) * 100,
      completed: stages.filter(s => s < this.user.stage),
      current_stage: this.user.stage,
      next_stage: this.user.stage + 1,
      completed_percentage: (completedStages / totalStages) * 100
    };
  }

  /**
   * Phase 2: Check if user needs admin approval
   */
  isPendingApproval() {
    return this.user && this.user.state === 'PENDING_APPROVAL';
  }

  /**
   * Phase 2: Check if user is blocked
   */
  isBlocked() {
    return this.user && this.user.state === 'BLOCKED';
  }

  /**
   * Phase 2: Get block reason
   */
  getBlockMessage() {
    if (this.isBlocked()) {
      return {
        title: 'Account Blocked',
        message: 'Your account has been restricted. Contact support@dolphin.com for assistance.',
        support_email: 'support@dolphin.com',
        support_priority: 'high'
      };
    }
    return null;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateManager;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  const stateManager = new StateManager();
  
  // Sync with backend to get latest state
  await stateManager.syncStateWithBackend();
  
  // Render conditional UI based on state
  stateManager.renderConditionalUI();
  
  // Display state indicator
  const stateIndicatorContainer = document.querySelector('.state-indicator-container');
  if (stateIndicatorContainer) {
    stateManager.displayStateIndicator('.state-indicator-container');
  }
  
  // Check for critical states
  if (stateManager.isPendingApproval()) {
    console.warn('User pending approval');
  }
  if (stateManager.isBlocked()) {
    const blockMsg = stateManager.getBlockMessage();
    alert(blockMsg.message);
  }
  
  // Make stateManager available globally for debugging
  window.stateManager = stateManager;
});
