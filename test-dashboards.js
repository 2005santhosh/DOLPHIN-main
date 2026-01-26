#!/usr/bin/env node

/**
 * DASHBOARD TESTING SCRIPT
 * Tests all 3 dashboards with state-driven rendering
 * Run: node test-dashboards.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

let testsPassed = 0;
let testsFailed = 0;
let currentTest = '';

// Helper function for colored output
function log(color, text) {
    console.log(`${color}${text}${colors.reset}`);
}

// Test result functions
function pass(message) {
    testsPassed++;
    log(colors.green, `✓ PASS: ${message}`);
}

function fail(message, error = '') {
    testsFailed++;
    log(colors.red, `✗ FAIL: ${message}`);
    if (error) log(colors.red, `  Error: ${error}`);
}

// HTTP request helper
function makeRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data ? JSON.parse(data) : null,
                        raw: data
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: null,
                        raw: data
                    });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Test suite
async function runTests() {
    log(colors.cyan, '\n════════════════════════════════════════════');
    log(colors.cyan, '  DOLPHIN PLATFORM - DASHBOARD TEST SUITE');
    log(colors.cyan, '════════════════════════════════════════════\n');

    // Test 1: Server Status
    log(colors.blue, '► TEST GROUP 1: Server & API Health\n');
    await testServerHealth();

    // Test 2: API Endpoints
    log(colors.blue, '\n► TEST GROUP 2: API Endpoint Tests\n');
    await testAPIEndpoints();

    // Test 3: HTML Content
    log(colors.blue, '\n► TEST GROUP 3: HTML Dashboard Content\n');
    await testHTMLDashboards();

    // Test 4: Frontend Integration
    log(colors.blue, '\n► TEST GROUP 4: Frontend Integration\n');
    await testFrontendIntegration();

    // Summary
    log(colors.cyan, '\n════════════════════════════════════════════');
    log(colors.cyan, '  TEST SUMMARY');
    log(colors.cyan, '════════════════════════════════════════════\n');

    log(colors.green, `Total Passed: ${testsPassed}`);
    if (testsFailed > 0) {
        log(colors.red, `Total Failed: ${testsFailed}`);
    } else {
        log(colors.green, `Total Failed: 0`);
    }

    const totalTests = testsPassed + testsFailed;
    const percentage = totalTests > 0 ? Math.round((testsPassed / totalTests) * 100) : 0;
    log(colors.cyan, `Success Rate: ${percentage}% (${testsPassed}/${totalTests})`);

    if (testsFailed === 0) {
        log(colors.green, '\n✓ ALL TESTS PASSED!\n');
        process.exit(0);
    } else {
        log(colors.red, `\n✗ ${testsFailed} TEST(S) FAILED\n`);
        process.exit(1);
    }
}

async function testServerHealth() {
    currentTest = 'Server Health';
    
    try {
        const res = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/profile',
            method: 'GET',
            headers: { 'Authorization': 'Bearer invalid' }
        });

        if (res.status === 401 || res.status === 400) {
            pass('Server responding to requests');
        } else {
            fail('Server should return 401 for invalid token', `Got ${res.status}`);
        }
    } catch (error) {
        fail('Cannot connect to server', error.message);
    }
}

async function testAPIEndpoints() {
    currentTest = 'API Endpoints';

    // Test endpoints exist (return something, not 404)
    const endpoints = [
        { path: '/api/auth/profile', name: 'GET /api/auth/profile', method: 'GET' },
        { path: '/api/founder/my-startup', name: 'GET /api/founder/my-startup', method: 'GET' },
        { path: '/api/investor/profile', name: 'GET /api/investor/profile', method: 'GET' },
        { path: '/api/provider/profile', name: 'GET /api/provider/profile', method: 'GET' },
    ];

    for (const endpoint of endpoints) {
        try {
            const res = await makeRequest({
                hostname: 'localhost',
                port: 5000,
                path: endpoint.path,
                method: endpoint.method,
                headers: { 'Authorization': 'Bearer invalid' }
            });

            // Endpoints should exist (not 404), even if auth fails
            if (res.status !== 404) {
                pass(`${endpoint.name} endpoint exists`);
            } else {
                fail(`${endpoint.name} endpoint not found`);
            }
        } catch (error) {
            fail(`${endpoint.name} endpoint error: ${error.message}`);
        }
    }
}

async function testHTMLDashboards() {
    currentTest = 'HTML Dashboards';

    const dashboards = [
        { path: 'frontend/dashboard.html', name: 'Founder Dashboard' },
        { path: 'frontend/investor-dashboard.html', name: 'Investor Dashboard' },
        { path: 'frontend/provider-dashboard.html', name: 'Provider Dashboard' },
    ];

    for (const dashboard of dashboards) {
        const filePath = path.join(__dirname, dashboard.path);
        
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Check for state indicator
            if (content.includes('id="state-indicator-container"')) {
                pass(`${dashboard.name} has state indicator container`);
            } else {
                fail(`${dashboard.name} missing state indicator container`);
            }

            // Check for data-require attributes
            if (content.includes('data-require-state=') || 
                content.includes('data-require-stage=') ||
                content.includes('data-require-role=')) {
                pass(`${dashboard.name} has data-require attributes`);
            } else {
                fail(`${dashboard.name} missing data-require attributes`);
            }

            // Check for block message containers
            if (content.includes('block-message-container')) {
                pass(`${dashboard.name} has block message containers`);
            } else {
                fail(`${dashboard.name} missing block message containers`);
            }

            // Check for script references
            if (content.includes('stateManager.js') || content.includes('app.js')) {
                pass(`${dashboard.name} includes JavaScript references`);
            } else {
                fail(`${dashboard.name} missing JavaScript references`);
            }
        } else {
            fail(`${dashboard.name} file not found at ${dashboard.path}`);
        }
    }
}

async function testFrontendIntegration() {
    currentTest = 'Frontend Integration';

    // Check StateManager.js exists and has required methods
    const stateManagerPath = path.join(__dirname, 'frontend/js/stateManager.js');
    if (fs.existsSync(stateManagerPath)) {
        const content = fs.readFileSync(stateManagerPath, 'utf-8');

        const requiredMethods = [
            { name: 'syncStateWithBackend', check: 'syncStateWithBackend' },
            { name: 'renderConditionalUI', check: 'renderConditionalUI' },
            { name: 'canAccessFeature', check: 'canAccessFeature' },
            { name: 'showBlockMessage', check: 'showBlockMessage' },
            { name: 'displayStateIndicator', check: 'displayStateIndicator' },
        ];

        for (const method of requiredMethods) {
            if (content.includes(method.check)) {
                pass(`StateManager has ${method.name} method`);
            } else {
                fail(`StateManager missing ${method.name} method`);
            }
        }
    } else {
        fail('StateManager.js not found');
    }

    // Check app.js includes StateManager
    const appPath = path.join(__dirname, 'frontend/js/app.js');
    if (fs.existsSync(appPath)) {
        const content = fs.readFileSync(appPath, 'utf-8');
        
        if (content.includes('stateManager') || content.includes('StateManager')) {
            pass('app.js references StateManager');
        } else {
            fail('app.js does not reference StateManager');
        }

        if (content.includes('syncStateWithBackend')) {
            pass('app.js calls syncStateWithBackend');
        } else {
            fail('app.js does not call syncStateWithBackend');
        }
    } else {
        fail('app.js not found');
    }

    // Check CSS has block message styles
    const cssPath = path.join(__dirname, 'frontend/css/style.css');
    if (fs.existsSync(cssPath)) {
        const content = fs.readFileSync(cssPath, 'utf-8');

        const requiredStyles = [
            { name: '.block-message-container', check: '.block-message-container' },
            { name: '#state-indicator-container', check: '#state-indicator-container' },
            { name: 'data-require attributes', check: '[data-require-' },
        ];

        for (const style of requiredStyles) {
            if (content.includes(style.check)) {
                pass(`CSS includes ${style.name} styling`);
            } else {
                fail(`CSS missing ${style.name} styling`);
            }
        }
    } else {
        fail('style.css not found');
    }
}

// Run tests
runTests().catch(error => {
    log(colors.red, `\nFatal error: ${error.message}`);
    process.exit(1);
});
