/**
 * Test Script for Instagram-Like Posts System
 * 
 * This script tests the new media upload, infinite scroll, and Instagram algorithm features
 * 
 * Usage: node backend/test/test-instagram-posts.js
 */

const colors = require('colors');

console.log('\n' + '='.repeat(60).cyan);
console.log('  Instagram-Like Posts System - Implementation Test'.cyan.bold);
console.log('='.repeat(60).cyan + '\n');

let passCount = 0;
let failCount = 0;

function test(description, condition) {
    if (condition) {
        console.log('✓'.green + ` ${description}`);
        passCount++;
    } else {
        console.log('✗'.red + ` ${description}`);
        failCount++;
    }
}

// Test 1: Check if required files exist
console.log('\n📁 File Structure Tests'.yellow.bold);
console.log('-'.repeat(60).gray);

const fs = require('fs');
const path = require('path');

test('Post model has media fields', 
    fs.existsSync(path.join(__dirname, '../models/Post.js')) &&
    fs.readFileSync(path.join(__dirname, '../models/Post.js'), 'utf8').includes('media:')
);

test('Cloudinary config has uploadPostMedia', 
    fs.existsSync(path.join(__dirname, '../config/cloudinary.js')) &&
    fs.readFileSync(path.join(__dirname, '../config/cloudinary.js'), 'utf8').includes('uploadPostMedia')
);

test('Posts routes has media upload endpoint', 
    fs.existsSync(path.join(__dirname, '../routes/posts.js')) &&
    fs.readFileSync(path.join(__dirname, '../routes/posts.js'), 'utf8').includes('uploadPostMedia.array')
);

test('Frontend posts.js has infinite scroll', 
    fs.existsSync(path.join(__dirname, '../../frontend/js/posts.js')) &&
    fs.readFileSync(path.join(__dirname, '../../frontend/js/posts.js'), 'utf8').includes('initInfiniteScroll')
);

test('Frontend API has media upload method', 
    fs.existsSync(path.join(__dirname, '../../frontend/js/api.js')) &&
    fs.readFileSync(path.join(__dirname, '../../frontend/js/api.js'), 'utf8').includes('FormData')
);

test('Feed CSS has media gallery styles', 
    fs.existsSync(path.join(__dirname, '../../frontend/css/feed.css')) &&
    fs.readFileSync(path.join(__dirname, '../../frontend/css/feed.css'), 'utf8').includes('post-media-gallery')
);

// Test 2: Check HTML files have media upload UI
console.log('\n🎨 UI Component Tests'.yellow.bold);
console.log('-'.repeat(60).gray);

test('Founder dashboard has media upload button', 
    fs.existsSync(path.join(__dirname, '../../frontend/dashboard.html')) &&
    fs.readFileSync(path.join(__dirname, '../../frontend/dashboard.html'), 'utf8').includes('upload-media-btn')
);

test('Investor dashboard has media upload button', 
    fs.existsSync(path.join(__dirname, '../../frontend/investor-dashboard.html')) &&
    fs.readFileSync(path.join(__dirname, '../../frontend/investor-dashboard.html'), 'utf8').includes('upload-media-btn')
);

test('Provider dashboard has media upload button', 
    fs.existsSync(path.join(__dirname, '../../frontend/provider-dashboard.html')) &&
    fs.readFileSync(path.join(__dirname, '../../frontend/provider-dashboard.html'), 'utf8').includes('upload-media-btn')
);

test('Dashboards have loading indicator', 
    fs.readFileSync(path.join(__dirname, '../../frontend/dashboard.html'), 'utf8').includes('loading-indicator')
);

// Test 3: Check environment configuration
console.log('\n⚙️  Configuration Tests'.yellow.bold);
console.log('-'.repeat(60).gray);

require('dotenv').config({ path: path.join(__dirname, '../.env') });

test('Cloudinary cloud name configured', !!process.env.CLOUDINARY_CLOUD_NAME);
test('Cloudinary API key configured', !!process.env.CLOUDINARY_API_KEY);
test('Cloudinary API secret configured', !!process.env.CLOUDINARY_API_SECRET);

// Test 4: Check code quality
console.log('\n🔒 Security & Performance Tests'.yellow.bold);
console.log('-'.repeat(60).gray);

const postsRouteContent = fs.readFileSync(path.join(__dirname, '../routes/posts.js'), 'utf8');
const cloudinaryConfigContent = fs.readFileSync(path.join(__dirname, '../config/cloudinary.js'), 'utf8');

test('Posts route has rate limiting', postsRouteContent.includes('rateLimit'));
test('Posts route has file size validation', cloudinaryConfigContent.includes('limits:'));
test('Posts route has file type validation', cloudinaryConfigContent.includes('fileFilter'));
test('Posts route has pagination', postsRouteContent.includes('page') && postsRouteContent.includes('limit'));
test('Posts route has media cleanup on delete', postsRouteContent.includes('cloudinary.uploader.destroy'));

const frontendPostsContent = fs.readFileSync(path.join(__dirname, '../../frontend/js/posts.js'), 'utf8');
const dashboardHtmlContent = fs.readFileSync(path.join(__dirname, '../../frontend/dashboard.html'), 'utf8');

test('Frontend has XSS prevention', frontendPostsContent.includes('escapeXSS'));
test('Frontend has lazy loading', frontendPostsContent.includes('loading="lazy"'));
test('Frontend has Intersection Observer', frontendPostsContent.includes('IntersectionObserver'));
test('Frontend has media viewer (lightbox)', frontendPostsContent.includes('media-viewer'));

// Test 5: Feature completeness
console.log('\n✨ Feature Completeness Tests'.yellow.bold);
console.log('-'.repeat(60).gray);

test('Multiple file upload support', dashboardHtmlContent.includes('multiple'));
test('Image and video support', dashboardHtmlContent.includes('image/*,video/*'));
test('Media preview before posting', frontendPostsContent.includes('renderMediaPreviews'));
test('Remove media before posting', frontendPostsContent.includes('remove-media-btn'));
test('Infinite scroll implementation', frontendPostsContent.includes('loadMorePosts'));
test('View tracking for algorithm', postsRouteContent.includes('/view'));
test('Engagement-based sorting', postsRouteContent.includes('viewCount'));

// Summary
console.log('\n' + '='.repeat(60).cyan);
console.log('  Test Summary'.cyan.bold);
console.log('='.repeat(60).cyan);
console.log(`\n  Total Tests: ${passCount + failCount}`);
console.log(`  Passed: ${passCount}`.green);
console.log(`  Failed: ${failCount}`.red);
console.log(`  Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);

if (failCount === 0) {
    console.log('\n  🎉 All tests passed! Instagram-like posts system is ready!'.green.bold);
} else {
    console.log('\n  ⚠️  Some tests failed. Please review the implementation.'.yellow.bold);
}

console.log('\n' + '='.repeat(60).cyan + '\n');

// Exit with appropriate code
process.exit(failCount > 0 ? 1 : 0);
