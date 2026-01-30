#!/usr/bin/env node

/**
 * PHASES 1-6 IMPLEMENTATION VERIFICATION SCRIPT
 *
 * Validates that all required components for state-driven dashboards are in place.
 * Run from repo root: node backend/test/verify-phases.js
 * Run from backend: node test/verify-phases.js
 */

const fs = require('fs');
const path = require('path');

// Repo root (parent of backend, which contains this test folder)
const ROOT = path.join(__dirname, '..', '..');

console.log('\n=== PHASES 1-6 PRODUCTION FRAMEWORK - IMPLEMENTATION VERIFICATION ===\n');

const checks = [];

// Helper function: filePath is relative to repo root
function checkFile(filePath, description, requiredContent = null) {
  const fullPath = path.join(ROOT, filePath);
  const exists = fs.existsSync(fullPath);

  const check = {
    status: 'PENDING',
    description,
    path: filePath,
    file: exists,
    content: false
  };

  if (exists) {
    check.status = 'PASS';
    if (requiredContent) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const hasContent = Array.isArray(requiredContent)
        ? requiredContent.every(str => content.includes(str))
        : content.includes(requiredContent);

      if (hasContent) {
        check.content = true;
      } else {
        check.status = 'FAIL';
        check.reason = `Missing required content: ${Array.isArray(requiredContent) ? requiredContent.join(', ') : requiredContent}`;
      }
    }
  } else {
    check.status = 'FAIL';
    check.reason = 'File not found';
  }

  checks.push(check);
  return check;
}

// PHASE 1: State-Driven Dashboards
console.log('PHASE 1: STATE-DRIVEN DASHBOARDS');
console.log('─'.repeat(50));

checkFile('backend/routes/auth.js', 'GET /api/auth/profile endpoint', [
  'GET /api/auth/profile',
  'authenticateToken',
  'user.state',
  'user.stage'
]);

checkFile('frontend/js/stateManager.js', 'StateManager class implementation', [
  'class StateManager',
  'syncStateWithBackend',
  'renderConditionalUI',
  'canAccessFeature',
  'stateConfig'
]);

checkFile('frontend/js/app.js', 'StateManager integration in app.js', [
  'stateManager.syncStateWithBackend',
  'stateManager.renderConditionalUI',
  'stateManager.displayStateIndicator'
]);

console.log('\nPHASE 2: ADMIN CONTROL LAYER');
console.log('─'.repeat(50));

checkFile('backend/routes/admin.js', 'Admin control endpoints', [
  'approve-user',
  'reject-user',
  'move-stage',
  'block-user',
  'unblock-user'
]);

checkFile('backend/middleware/roleAccess.js', 'Role-based access control', [
  'investor',
  'founder',
  'provider'
]);

console.log('\nPHASE 3: STAGE GATING');
console.log('─'.repeat(50));

checkFile('backend/middleware/stageGating.js', 'Stage gating middleware', [
  'checkStageAccess',
  'user.stage'
]);

checkFile('backend/models/Startup.js', 'Startup model with stage tracking', [
  'currentStage',
  'milestones'
]);

console.log('\nPHASE 4: CONTROLLED INTERACTIONS');
console.log('─'.repeat(50));

checkFile('backend/models/IntroRequest.js', 'IntroRequest model', [
  'status',
  'initiatorId',
  'recipientId',
  'REQUESTED',
  'ACCEPTED',
  'REJECTED'
]);

checkFile('backend/routes/provider.js', 'Provider interaction endpoints', [
  'request-intro',
  'my-requests'
]);

console.log('\nPHASE 5: VISIBILITY & TRANSPARENCY');
console.log('─'.repeat(50));

checkFile('frontend/js/stateManager.js', 'getBlockReason method', [
  'getBlockReason',
  'nextSteps',
  'estimatedTime'
]);

console.log('\nPHASE 6: DOCUMENTATION & MAINTAINABILITY');
console.log('─'.repeat(50));

checkFile('PHASES_1_TO_6_PRODUCTION_FRAMEWORK.md', 'Complete production framework docs', [
  'PHASE 1:',
  'PHASE 2:',
  'PHASE 3:',
  'PHASE 4:',
  'PHASE 5:',
  'PHASE 6:'
]);

checkFile('STATE_DRIVEN_DASHBOARD_INTEGRATION.md', 'Dashboard integration guide', [
  'data-require-state',
  'data-require-stage',
  'data-require-role',
  'stateManager.showBlockMessage'
]);

console.log('\n' + '='.repeat(60));
console.log('IMPLEMENTATION VERIFICATION RESULTS');
console.log('='.repeat(60));

const passCount = checks.filter(c => c.status === 'PASS').length;
const failCount = checks.filter(c => c.status === 'FAIL').length;

checks.forEach(check => {
  const icon = check.status === 'PASS' ? '✓' : '✗';
  const status = check.status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(`\n[${icon}] ${status}: ${check.description}`);
  console.log(`    Path: ${check.path}`);
  if (check.reason) {
    console.log(`    Issue: ${check.reason}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`SUMMARY: ${passCount} PASS, ${failCount} FAIL`);
console.log('='.repeat(60));

if (failCount === 0) {
  console.log('\n✓ ALL CHECKS PASSED! System ready for deployment.\n');
  process.exit(0);
} else {
  console.log(`\n✗ ${failCount} checks failed. Please review and fix issues above.\n`);
  process.exit(1);
}
