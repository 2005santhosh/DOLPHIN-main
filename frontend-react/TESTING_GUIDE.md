# 🧪 Complete Testing Guide

## 📋 Pre-Testing Checklist

Before you start testing, ensure:

- [ ] Backend server is running on `localhost:5000` or `api.dolphinorg.in`
- [ ] Frontend React dev server is running: `npm run dev` in `frontend-react/`
- [ ] Browser is open to `http://localhost:5173/`
- [ ] Browser cache is cleared (Ctrl+Shift+R)
- [ ] Browser console is open (F12) to check for errors

---

## 1️⃣ Landing Page Tests

### Visual Tests

**Expected Results:**
- Background color: Light gray (#F8FAFC)
- Primary buttons: Lime green (#84CC16)
- Text color: Dark slate (#0F172A)
- Cards: White (#FFFFFF)

**Test Steps:**
1. Open `http://localhost:5173/`
2. Verify the hero section shows:
   - Title: "Turn Your Startup Idea Into Fundable Reality"
   - Description mentions "founders, freelancers, and investors"
3. Check desktop navigation (top right):
   - "Features" link
   - "How It Works" link
   - "Log In" button (white with border)
   - "Start Free" button (lime green)
4. Scroll down and verify sections:
   - Trust bar with stats
   - Features bento grid
   - Benefits section
   - Process roadmap (4 stages)
   - CTA section
   - Footer

### Mobile View Tests

**Test Steps:**
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone 12" or similar
4. Verify mobile menu:
   - Hamburger icon (☰) in top right
   - Click it to open mobile menu
   - Menu slides in from right
5. Scroll to bottom of page
6. Verify bottom navigation bar shows:
   - 📱 Features
   - 🗺️ Roadmap
   - 🔐 Login
   - → Start (lime green)

**Expected Results:**
- ✅ Bottom nav is visible and fixed at bottom
- ✅ Login button is clearly visible
- ✅ All buttons are tappable

### Navigation Tests

**Test 1: Desktop "Start Free" Button**
1. Click "Start Free" in top nav
2. Expected: Redirects to `/register.html`

**Test 2: Desktop "Log In" Button**
1. Click "Log In" in top nav
2. Expected: Redirects to `/login.html`

**Test 3: Hero "Start Your Journey" Button**
1. Click the large lime green button in hero
2. Expected: Redirects to `/register.html`

**Test 4: Mobile Bottom Nav "Login"**
1. Switch to mobile view
2. Click "🔐 Login" in bottom nav
3. Expected: Redirects to `/login.html`

**Test 5: Mobile Bottom Nav "Start"**
1. In mobile view
2. Click "→ Start" in bottom nav
3. Expected: Redirects to `/register.html`

**Test 6: CTA Section Button**
1. Scroll to "Ready to validate your idea?" section
2. Click "Get Started Free →"
3. Expected: Redirects to `/register.html`

---

## 2️⃣ Registration Tests

### Form Validation Tests

**Test 1: Empty Form Submission**
1. Go to `/register.html`
2. Click "Create Account" without filling anything
3. Expected: Form shows validation errors

**Test 2: Invalid Email**
1. Enter name: "Test User"
2. Enter email: "invalid-email"
3. Enter password: "password123"
4. Select role: "Founder"
5. Click "Create Account"
6. Expected: Email validation error

**Test 3: Short Password**
1. Enter name: "Test User"
2. Enter email: "test@example.com"
3. Enter password: "123"
4. Select role: "Founder"
5. Click "Create Account"
6. Expected: Password length error

**Test 4: Successful Registration**
1. Enter name: "Test Founder"
2. Enter email: "testfounder@example.com"
3. Enter password: "password123"
4. Select role: "Founder"
5. Click "Create Account"
6. Expected:
   - Success message appears
   - Redirects to `/dashboard.html`
   - Dashboard loads with user data

### Visual Tests

**Expected Results:**
- Form has lime green submit button
- Input fields have light borders
- Focus state shows lime green border
- Role selector has 3 options: Founder, Investor, Provider
- "Already have an account? Log in" link at bottom

---

## 3️⃣ Login Tests

### Form Tests

**Test 1: Empty Form**
1. Go to `/login.html`
2. Click "Sign In" without filling anything
3. Expected: Validation errors

**Test 2: Invalid Credentials**
1. Enter email: "wrong@example.com"
2. Enter password: "wrongpassword"
3. Click "Sign In"
4. Expected: Error message "Invalid credentials"

**Test 3: Successful Login (Founder)**
1. Enter email: "testfounder@example.com"
2. Enter password: "password123"
3. Click "Sign In"
4. Expected:
   - Success message
   - Redirects to `/dashboard.html`
   - Founder dashboard loads

**Test 4: Successful Login (Investor)**
1. Register as investor first
2. Login with investor credentials
3. Expected: Redirects to `/investor-dashboard.html`

**Test 5: Successful Login (Provider)**
1. Register as provider first
2. Login with provider credentials
3. Expected: Redirects to `/provider-dashboard.html`

---

## 4️⃣ Founder Dashboard Tests

### Navigation Tests

**Test 1: Sidebar Navigation**
1. Login as founder
2. Click each sidebar item:
   - Dashboard
   - Profile
   - Stages
   - Tasks
   - Analytics
   - Investors & Providers
   - Posts
   - Requests
   - Chat
   - Settings
3. Expected: Each page loads without errors

**Test 2: Mobile Sidebar**
1. Switch to mobile view
2. Click hamburger menu
3. Sidebar slides in from left
4. Click any nav item
5. Expected: Page loads and sidebar closes

### Dashboard Page Tests

**Test 1: Stats Display**
1. Go to Dashboard page
2. Verify stats cards show:
   - Stages Completed (e.g., "0/5")
   - Tasks Completed (e.g., "0/15")
   - Reward Points (e.g., "0")
3. Expected: All stats are visible and formatted correctly

**Test 2: Progress Bar**
1. Check progress card at top
2. Expected:
   - Shows startup name or "My Startup"
   - Shows progress percentage
   - Progress bar fills based on completion

**Test 3: Validation Roadmap**
1. Scroll to "Validation Roadmap" section
2. Verify 5 stages are listed:
   - Idea Validation
   - Problem Definition
   - Solution Development
   - Market Validation
   - Business Model Validation
3. Expected: Each stage shows status (Locked/Not Started/Validated)

### Profile Page Tests

**Test 1: View Startup Profile**
1. Click "Profile" in sidebar
2. Expected:
   - Shows startup information form
   - All fields are editable
   - Save button is visible

**Test 2: Create Startup (if none exists)**
1. If no startup exists, form should be empty
2. Fill in:
   - Startup Name: "Test Startup"
   - Description: "A test startup"
   - Industry: "Technology"
   - Stage: "Idea"
3. Click "Save Changes"
4. Expected: Success message and data is saved

**Test 3: Update Startup**
1. Change startup name
2. Click "Save Changes"
3. Expected: Success message
4. Refresh page
5. Expected: Changes are persisted

### Stages Page Tests

**Test 1: View Stages**
1. Click "Stages" in sidebar
2. Expected:
   - Shows 5 validation stages
   - First stage is unlocked
   - Other stages are locked

**Test 2: Start Validation**
1. Click "Start Validation" on first stage
2. Expected:
   - Modal opens with questionnaire
   - Questions are displayed
   - Submit button is visible

**Test 3: Submit Validation**
1. Answer all questions
2. Click "Submit"
3. Expected:
   - Loading indicator
   - Success message
   - Score is displayed
   - Stage status updates

### Posts Page Tests

**Test 1: View Feed**
1. Click "Posts" in sidebar
2. Expected:
   - Feed loads with posts
   - Each post shows author, content, likes, views
   - Create post button is visible

**Test 2: Create Post**
1. Click "Create Post" button
2. Enter text: "This is a test post"
3. Click "Post"
4. Expected:
   - Success message
   - New post appears in feed

**Test 3: Like Post**
1. Click like button on any post
2. Expected:
   - Like count increases
   - Button changes color

**Test 4: Upload Image**
1. Click "Create Post"
2. Click image upload area
3. Select an image
4. Enter text
5. Click "Post"
6. Expected:
   - Post is created with image
   - Image is displayed in feed

### Chat Page Tests

**Test 1: View Conversations**
1. Click "Chat" in sidebar
2. Expected:
   - Shows list of conversations
   - Or shows empty state if no conversations

**Test 2: Send Message**
1. Click on a conversation
2. Type a message
3. Press Enter or click Send
4. Expected:
   - Message appears in chat
   - Timestamp is shown

### Settings Page Tests

**Test 1: Update Profile**
1. Click "Settings" in sidebar
2. Change name
3. Click "Save Changes"
4. Expected: Success message

**Test 2: Change Password**
1. Go to Settings
2. Enter current password
3. Enter new password
4. Confirm new password
5. Click "Update Password"
6. Expected: Success message

**Test 3: Upload Profile Picture**
1. Go to Settings
2. Click profile picture area
3. Select an image
4. Expected:
   - Image uploads
   - Profile picture updates

---

## 5️⃣ Provider Dashboard Tests

### Dashboard Tests

**Test 1: View Overview**
1. Login as provider
2. Expected:
   - Dashboard shows stats
   - Shows recent activity
   - Navigation works

### Founders Page Tests

**Test 1: Browse Founders**
1. Click "Founders" in sidebar
2. Expected:
   - Shows list of eligible founders
   - Each founder card shows:
     - Name
     - Startup name
     - Stage
     - Validation score
   - Connect button is visible

**Test 2: Send Connection Request**
1. Click "Connect" on a founder
2. Enter message
3. Click "Send Request"
4. Expected:
   - Success message
   - Button changes to "Request Sent"

---

## 6️⃣ Investor Dashboard Tests

### Startups Page Tests

**Test 1: Browse Startups**
1. Login as investor
2. Click "Startups" in sidebar
3. Expected:
   - Shows validated startups (70%+ score)
   - Each card shows:
     - Startup name
     - Founder name
     - Validation score
     - Stage
   - View details button

**Test 2: Filter Startups**
1. Use filter dropdown
2. Select a stage
3. Expected: List updates to show only that stage

**Test 3: Add to Watchlist**
1. Click "Add to Watchlist" on a startup
2. Expected:
   - Success message
   - Button changes to "Remove from Watchlist"

### Watchlist Page Tests

**Test 1: View Watchlist**
1. Click "Watchlist" in sidebar
2. Expected:
   - Shows saved startups
   - Or shows empty state if none saved

---

## 7️⃣ Theme Consistency Tests

### Color Tests

**Test Each Page:**
1. Landing page
2. Login page
3. Register page
4. All dashboard pages

**Verify:**
- [ ] Background is #F8FAFC (light gray)
- [ ] Cards are #FFFFFF (white)
- [ ] Primary buttons are #84CC16 (lime green)
- [ ] Text is #0F172A (dark slate)
- [ ] Borders are #E2E8F0 (light gray)
- [ ] Hover states work (buttons lift, colors change)

### Responsive Tests

**Test Each Page at Different Sizes:**
1. Desktop (1920x1080)
2. Laptop (1366x768)
3. Tablet (768x1024)
4. Mobile (375x667)

**Verify:**
- [ ] Layout adapts correctly
- [ ] Text is readable
- [ ] Buttons are tappable
- [ ] Images scale properly
- [ ] No horizontal scroll

---

## 8️⃣ Performance Tests

### Load Time Tests

**Test 1: Initial Load**
1. Clear cache
2. Open `http://localhost:5173/`
3. Check Network tab in DevTools
4. Expected: Page loads in < 3 seconds

**Test 2: Navigation Speed**
1. Click between pages
2. Expected: Pages load instantly (< 500ms)

### API Response Tests

**Test 1: Dashboard Load**
1. Login and go to dashboard
2. Check Network tab
3. Expected: API calls complete in < 2 seconds

---

## 9️⃣ Error Handling Tests

### Network Error Tests

**Test 1: Offline Mode**
1. Open DevTools
2. Go to Network tab
3. Select "Offline"
4. Try to login
5. Expected: Error message "Network error"

**Test 2: API Error**
1. Stop backend server
2. Try to load dashboard
3. Expected: Error message or loading state

### Form Error Tests

**Test 1: Validation Errors**
1. Submit forms with invalid data
2. Expected: Clear error messages

**Test 2: Server Errors**
1. Try to register with existing email
2. Expected: "Email already exists" error

---

## 🎯 Success Criteria

All tests should pass with:
- ✅ No console errors
- ✅ No broken images
- ✅ No layout issues
- ✅ All navigation works
- ✅ All forms submit correctly
- ✅ Theme is consistent
- ✅ Responsive design works
- ✅ API integration works
- ✅ Error handling works

---

## 📊 Test Results Template

Use this template to track your testing:

```
## Test Session: [Date]

### Landing Page
- [ ] Visual tests passed
- [ ] Mobile view passed
- [ ] Navigation tests passed
- Issues: [None / List issues]

### Registration
- [ ] Form validation passed
- [ ] Successful registration passed
- Issues: [None / List issues]

### Login
- [ ] Form tests passed
- [ ] Role-based redirect passed
- Issues: [None / List issues]

### Founder Dashboard
- [ ] All 10 pages load
- [ ] Navigation works
- [ ] Forms submit correctly
- Issues: [None / List issues]

### Provider Dashboard
- [ ] All 7 pages load
- [ ] Functionality works
- Issues: [None / List issues]

### Investor Dashboard
- [ ] All 7 pages load
- [ ] Functionality works
- Issues: [None / List issues]

### Theme
- [ ] Colors are correct
- [ ] Responsive design works
- Issues: [None / List issues]

### Performance
- [ ] Load times acceptable
- [ ] No lag or freezing
- Issues: [None / List issues]

### Overall Status
- [ ] All tests passed
- [ ] Ready for deployment
- Issues to fix: [None / List issues]
```

---

## 🐛 Reporting Issues

If you find any issues during testing:

1. **Note the issue details:**
   - What page/feature
   - What you did
   - What happened
   - What you expected
   - Browser console errors

2. **Check if it's a known issue:**
   - Hard refresh (Ctrl+Shift+R)
   - Clear cache
   - Try different browser

3. **Document the issue:**
   - Take screenshots
   - Copy console errors
   - Note steps to reproduce

---

## ✅ Final Verification

Before considering testing complete:

- [ ] All pages load without errors
- [ ] All navigation works
- [ ] All forms submit correctly
- [ ] Theme is consistent
- [ ] Mobile view works
- [ ] API integration works
- [ ] Error handling works
- [ ] Performance is acceptable
- [ ] No console errors
- [ ] Ready for user acceptance testing

**If all checkboxes are checked, the React migration is complete and ready for deployment! 🎉**
