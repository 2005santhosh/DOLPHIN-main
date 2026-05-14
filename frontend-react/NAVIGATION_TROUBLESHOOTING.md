# 🔧 Navigation Troubleshooting Guide

## Problem: Clicking Login/Start Always Redirects to Landing Page

### Most Likely Cause: You're Already Logged In

When you're logged in, the `PublicRoute` component automatically redirects you to your dashboard when you try to access login/register pages. This is intentional security behavior.

---

## ✅ Solution 1: Log Out First (Easiest)

### Option A: Use the Logout Button
1. Look at the top navbar
2. If you're logged in, you'll see **[Dashboard]** and **[Log Out]** buttons instead of **[Log In]** and **[Start Free]**
3. Click **[Log Out]**
4. Now try clicking **[Log In]** or **[Start Free]** again
5. ✅ Should work correctly

### Option B: Use the Clear Auth Page
1. Navigate to: `http://localhost:5175/clear-auth.html`
2. Click **"Clear Authentication & Reload"**
3. ✅ You'll be logged out and redirected to landing page

### Option C: Clear Browser Storage Manually
1. Press `F12` to open DevTools
2. Go to **"Application"** tab (Chrome) or **"Storage"** tab (Firefox)
3. Click **"Local Storage"** → **"http://localhost:5175"**
4. Delete these entries:
   - `user`
   - `token`
   - `startupData` (optional)
5. Refresh the page (`F5`)
6. ✅ You're now logged out

---

## 🔍 How to Check If You're Logged In

### Method 1: Look at the Navbar
- **Logged OUT**: Shows **[Log In]** and **[Start Free]** buttons
- **Logged IN**: Shows **[Dashboard]** and **[Log Out]** buttons

### Method 2: Check Browser Console
1. Press `F12` to open DevTools
2. Go to **"Console"** tab
3. Look for: `Landing Page - Auth Status: { isAuthenticated: true/false, ... }`
4. If `isAuthenticated: true` → You're logged in
5. If `isAuthenticated: false` → You're logged out

### Method 3: Check Local Storage
1. Press `F12` to open DevTools
2. Go to **"Application"** or **"Storage"** tab
3. Click **"Local Storage"** → **"http://localhost:5175"**
4. If you see `user` and `token` entries → You're logged in
5. If they're empty or missing → You're logged out

---

## 🎯 Expected Behavior

### When Logged OUT:
- Clicking **[Log In]** → Goes to `/login` page ✅
- Clicking **[Start Free]** → Goes to `/register` page ✅
- Clicking **[Start Your Journey]** → Goes to `/register` page ✅

### When Logged IN:
- Clicking **[Dashboard]** → Goes to your dashboard ✅
- Clicking **[Log Out]** → Logs you out and stays on landing page ✅
- Trying to access `/login` or `/register` → Redirects to dashboard ✅ (security feature)

---

## 🐛 Still Not Working?

### Step 1: Clear Everything
```javascript
// Open browser console (F12 → Console tab)
// Paste this and press Enter:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Step 2: Hard Refresh
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### Step 3: Check Browser Console for Errors
1. Press `F12` → Go to **"Console"** tab
2. Look for any red error messages
3. Share them if you see any

### Step 4: Verify Dev Server is Running
- Check terminal shows: `Local: http://localhost:5175/`
- If not, restart: `npm run dev` in `frontend-react/` folder

### Step 5: Try Incognito/Private Window
1. Open a new incognito/private window
2. Navigate to `http://localhost:5175/`
3. Try clicking **[Log In]** or **[Start Free]**
4. Should work correctly (no stored auth data)

---

## 📋 Quick Test Checklist

Run through this checklist:

1. **Check if logged in**
   - [ ] Look at navbar - do you see [Log Out] button?
   - [ ] If yes, click [Log Out]
   - [ ] If no, proceed to next step

2. **Test navigation**
   - [ ] Click [Log In] → Should go to login page
   - [ ] Go back to landing page
   - [ ] Click [Start Free] → Should go to register page
   - [ ] Go back to landing page
   - [ ] Click [Start Your Journey] → Should go to register page

3. **Test mobile navigation**
   - [ ] Press F12 → Ctrl+Shift+M (mobile view)
   - [ ] Click [Log In] in top navbar → Should go to login page
   - [ ] Go back to landing page
   - [ ] Scroll to bottom
   - [ ] Click [→ Start] → Should go to register page

4. **Verify no errors**
   - [ ] Press F12 → Console tab
   - [ ] No red error messages
   - [ ] See: "Landing Page - Auth Status: { isAuthenticated: false, ... }"

---

## 🎓 Understanding the Behavior

### Why does it redirect when logged in?

This is a **security feature** called "PublicRoute":

```javascript
// If you're logged in and try to access login/register pages
// You get redirected to your dashboard
// This prevents confusion and improves UX
```

**Example:**
- You're logged in as a Founder
- You try to go to `/login`
- App thinks: "Why would a logged-in user need the login page?"
- App redirects you to `/dashboard` (your founder dashboard)

### How to test login/register pages when logged in?

**You can't!** You must log out first. This is intentional.

**Workaround for testing:**
1. Open an incognito/private window
2. Navigate to `http://localhost:5175/`
3. Test login/register pages there
4. Keep your main window logged in for dashboard testing

---

## 🚀 Quick Commands

### Clear Auth (Browser Console)
```javascript
localStorage.removeItem('user');
localStorage.removeItem('token');
location.reload();
```

### Check Auth Status (Browser Console)
```javascript
console.log('User:', localStorage.getItem('user'));
console.log('Token:', localStorage.getItem('token'));
```

### Force Logout (Browser Console)
```javascript
localStorage.clear();
sessionStorage.clear();
location.href = '/';
```

---

## ✅ Summary

**The navigation IS working correctly!**

The issue is that you're logged in, and the app is protecting you from accessing login/register pages when you're already authenticated.

**Solution:**
1. Click **[Log Out]** button in the navbar
2. OR visit `http://localhost:5175/clear-auth.html`
3. OR clear localStorage manually (F12 → Application → Local Storage)

**Then test again - it will work!** 🎉

---

## 📞 Need More Help?

If you've tried everything above and it's still not working:

1. **Take a screenshot** of:
   - The landing page navbar (to see which buttons are showing)
   - Browser console (F12 → Console tab)
   - Local Storage (F12 → Application → Local Storage)

2. **Share this information**:
   - Are you seeing [Log In] or [Log Out] in the navbar?
   - Any error messages in console?
   - What happens when you click the button? (stays on same page? redirects where?)

This will help diagnose the exact issue!
