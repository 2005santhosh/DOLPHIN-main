# Profile Image & Reward Points Fix

## Issues Fixed

### 1. Profile Image Not Displaying
**Problem**: Profile image from Cloudinary was not showing in the header

**Root Cause**: 
- AuthContext was fetching profile only once on initial load
- No periodic refresh to get updated profile data
- DashboardPage was fetching profile but not updating the AuthContext

**Solution Applied**:

#### A. Added Periodic Profile Refresh in AuthContext
```javascript
// Refresh profile every 30 seconds to get updated points and image
const refreshInterval = setInterval(async () => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const profile = await authAPI.getProfile();
      console.log('Profile refreshed:', profile.name, 'Points:', profile.rewardPoints);
      setUser(profile);
      localStorage.setItem('user', JSON.stringify(profile));
    } catch (error) {
      console.error('Profile refresh failed:', error);
    }
  }
}, 30000); // 30 seconds
```

#### B. Added Manual Refresh Function
```javascript
// Refresh user profile from server
const refreshProfile = async () => {
  try {
    const profile = await authAPI.getProfile();
    console.log('Profile manually refreshed:', profile.name, 'Points:', profile.rewardPoints);
    setUser(profile);
    localStorage.setItem('user', JSON.stringify(profile));
    return profile;
  } catch (error) {
    console.error('Profile refresh failed:', error);
    throw error;
  }
};
```

#### C. Updated DashboardPage to Use refreshProfile
```javascript
const { user, refreshProfile } = useAuth();

// In loadDashboard:
const [startupData, profileData] = await Promise.all([
  api.getStartup().catch(() => null),
  refreshProfile ? refreshProfile().catch(() => null) : api.getProfile()
]);
```

#### D. Added Debug Logging
```javascript
// In Header.jsx
useEffect(() => {
  console.log('Header - User data:', {
    name: user?.name,
    profilePicture: user?.profilePicture,
    rewardPoints: user?.rewardPoints,
    pointsProp: points
  });
}, [user, points]);

// In AuthContext
console.log('Profile fetched:', profile.name, 'Points:', profile.rewardPoints, 'Image:', profile.profilePicture);
```

### 2. Reward Points Not Showing
**Problem**: Reward points were 0 or not updating in the header

**Root Cause**: Same as profile image - user object wasn't being refreshed

**Solution**: Same fixes as above ensure reward points are updated

## How It Works Now

### Data Flow
1. **Initial Load**:
   - AuthContext loads user from localStorage (instant)
   - Immediately fetches fresh profile from API
   - Updates user state with latest data (including profilePicture and rewardPoints)

2. **Periodic Refresh** (Every 30 seconds):
   - AuthContext automatically fetches latest profile
   - Updates user state
   - Header re-renders with new data

3. **Manual Refresh** (When needed):
   - Components can call `refreshProfile()` from useAuth()
   - Useful after actions that change points (completing tasks, etc.)
   - DashboardPage calls this on load

4. **Header Display**:
   - Receives `points` prop from FounderDashboard
   - Also has access to `user` from AuthContext
   - Displays profile image with proper fallback
   - Shows reward points

### Profile Image Handling
```javascript
{user?.profilePicture ? (
  <img
    src={user.profilePicture.startsWith('http') 
      ? user.profilePicture 
      : `${window.location.origin}${user.profilePicture}`}
    alt={user.name}
    onError={(e) => {
      // Fallback to initials if image fails
      const parent = e.target.parentElement;
      e.target.style.display = 'none';
      const fallback = parent.querySelector('.avatar-fallback');
      if (fallback) fallback.style.display = 'flex';
    }}
  />
) : null}
<div className="avatar-fallback" style={{ display: user?.profilePicture ? 'none' : 'flex' }}>
  {getInitials(user?.name)}
</div>
```

## Files Modified

1. **frontend-react/src/context/AuthContext.jsx**
   - Added periodic profile refresh (30 seconds)
   - Added `refreshProfile()` function
   - Added debug logging
   - Cleanup interval on unmount

2. **frontend-react/src/components/shared/Header.jsx**
   - Added debug logging for user data
   - Profile image display already correct

3. **frontend-react/src/components/founder/pages/DashboardPage.jsx**
   - Uses `refreshProfile()` from AuthContext
   - Logs profile data for debugging
   - Ensures fresh data on dashboard load

## Testing

### Check Console Logs
You should see these logs in the browser console:

1. **On Login/Page Load**:
```
Auth Init - Token exists: true User exists: true
Profile fetched: [Name] Points: [Number] Image: [URL]
```

2. **Every 30 Seconds**:
```
Profile refreshed: [Name] Points: [Number]
```

3. **On Dashboard Load**:
```
Dashboard - Profile data: { name: ..., rewardPoints: ..., profilePicture: ... }
```

4. **In Header**:
```
Header - User data: { name: ..., profilePicture: ..., rewardPoints: ..., pointsProp: ... }
```

### Visual Verification

1. **Profile Image**:
   - Should display Cloudinary image if uploaded
   - Should show initials in colored circle if no image
   - Should handle errors gracefully

2. **Reward Points**:
   - Should show correct number next to ⭐ icon
   - Should update when you complete tasks
   - Should refresh every 30 seconds

## Troubleshooting

### If Profile Image Still Not Showing

1. **Check Console Logs**:
   - Look for "Profile fetched" log
   - Verify `profilePicture` field has a value
   - Check if it's a valid URL

2. **Check Network Tab**:
   - Look for `/api/auth/profile` request
   - Verify response includes `profilePicture` field
   - Check if Cloudinary URL is accessible

3. **Check User Object**:
   - Open React DevTools
   - Find AuthContext
   - Verify `user.profilePicture` has a value

### If Reward Points Still Not Showing

1. **Check Console Logs**:
   - Look for "Profile fetched" log
   - Verify `rewardPoints` field has a value

2. **Check Props**:
   - Header should receive `points` prop from FounderDashboard
   - FounderDashboard gets it from `user.rewardPoints`

3. **Check Backend**:
   - Verify `/api/auth/profile` returns `rewardPoints`
   - Check if user document in MongoDB has `rewardPoints` field

## Expected Behavior

✅ Profile image displays immediately on page load  
✅ Profile image updates when changed in settings  
✅ Reward points display correctly  
✅ Reward points update when tasks are completed  
✅ Data refreshes automatically every 30 seconds  
✅ Fallback to initials if image fails to load  
✅ Console logs show data being fetched  

## Next Steps

If issues persist:
1. Check browser console for errors
2. Verify backend API is returning correct data
3. Check MongoDB user document has the fields
4. Verify Cloudinary URLs are accessible
5. Test with different browsers
