# React Conversion Complete Guide

## 📊 Current Status: 65% Complete

### ✅ COMPLETED COMPONENTS

#### Infrastructure (100%)
- React 19 + Vite setup
- React Router with protected routes
- React Query for data fetching
- React Hot Toast for notifications
- Authentication context
- API service layer
- Theme and global styles

#### Shared Components (100%)
- `PageHeader` - Page titles and subtitles
- `Card`, `CardHeader`, `CardTitle` - Card layouts
- `StatCard` - Statistics display
- `Modal` - Generic modal dialogs
- `LoadingSpinner` - Loading states
- `Header` - Top navigation with notifications
- `Sidebar` - Side navigation with badges

#### Founder Dashboard Pages (40%)
1. ✅ **DashboardPage** - Progress tracking, stats, roadmap
2. ✅ **ProfilePage** - Startup information management
3. ✅ **StagesPage** - AI validation stages with modals
4. ✅ **SettingsPage** - Account settings, password, legal, delete account

### 🚧 REMAINING WORK (35%)

#### Critical Pages
5. **TasksPage** - Growth roadmap with task completion
6. **PostsPage** - Instagram-like feed with media upload
7. **ChatPage** - Real-time messaging
8. **InvestorsProvidersPage** - Networking features
9. **RequestsPage** - Connection management
10. **AnalyticsPage** - Charts and metrics

#### Other Dashboards
11. **InvestorDashboard** - Complete investor interface
12. **ProviderDashboard** - Complete provider interface
13. **AdminDashboard** - Complete admin interface

## 🎯 IMPLEMENTATION GUIDE

### For Each Remaining Page:

#### Step 1: Read Reference Files
```bash
# For TasksPage example:
frontend/dashboard.html (lines 300-350)
frontend/js/dashboard.js (lines 1000-1050)
frontend/css/founderDashboard.css (relevant sections)
```

#### Step 2: Create Component Structure
```javascript
import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import toast from 'react-hot-toast';
import api from '../../../services/api';

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const result = await api.getRoadmap();
      setTasks(result.tasks || []);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Growth Roadmap" subtitle="Your step-by-step journey" />
      {/* Component content */}
    </div>
  );
};

export default TasksPage;
```

#### Step 3: Implement Features
- State management
- Data fetching
- Event handlers
- UI rendering
- Error handling

#### Step 4: Test Thoroughly
- Load data correctly
- All interactions work
- Mobile responsive
- Error states handled
- Loading states shown

## 📝 DETAILED IMPLEMENTATION SPECS

### 5. TasksPage

**File:** `frontend-react/src/components/founder/pages/TasksPage.jsx`

**Features:**
- Display growth roadmap tasks
- Task completion with points reward
- Locked/unlocked state based on validation
- Phase-based organization
- Real-time points update

**API Endpoints:**
```javascript
api.getRoadmap() // GET /api/founder/roadmap
api.completeRoadmapTask(taskKey) // POST /api/founder/roadmap/complete/:taskKey
```

**UI Structure:**
```jsx
<PageHeader />
<LockedMessage /> {/* If validation < 100% */}
<TasksList>
  {tasks.map(task => (
    <TaskCard
      key={task.key}
      title={task.title}
      description={task.description}
      phase={task.phase}
      points={task.points}
      status={task.status} // locked, available, completed
      onComplete={() => completeTask(task.key)}
    />
  ))}
</TasksList>
```

### 6. PostsPage

**File:** `frontend-react/src/components/founder/pages/PostsPage.jsx`

**Features:**
- Instagram-like feed
- Media upload (images/videos up to 100MB, max 10 files)
- Infinite scroll with pagination
- Like/unlike functionality
- Delete own posts
- Tabs: All Posts / My Posts
- Real-time preview before posting

**API Endpoints:**
```javascript
api.getPosts(page, filter) // GET /api/posts?page=1&filter=all
api.createPost(formData) // POST /api/posts (with FormData)
api.likePost(postId) // POST /api/posts/:id/like
api.deletePost(postId) // DELETE /api/posts/:id
```

**Key Components:**
```jsx
<FeedTabs /> // All Posts / My Posts
<CreatePostCard>
  <MediaUpload /> // Drag & drop or click to upload
  <MediaPreview /> // Show selected media
  <PostForm /> // Content, type, tags
</CreatePostCard>
<PostsFeed>
  <InfiniteScroll onLoadMore={loadMore}>
    {posts.map(post => (
      <PostCard
        key={post._id}
        post={post}
        onLike={handleLike}
        onDelete={handleDelete}
      />
    ))}
  </InfiniteScroll>
</PostsFeed>
```

**Reference:** `frontend/js/posts.js` (complete file)

### 7. ChatPage

**File:** `frontend-react/src/components/founder/pages/ChatPage.jsx`

**Features:**
- Real-time messaging with Socket.io
- Conversation list with search
- Message sending/receiving
- Unread badges
- Mobile responsive (slide-in/out)
- Auto-scroll to latest message

**Socket.io Integration:**
```javascript
import io from 'socket.io-client';

const socket = io('https://api.dolphinorg.in', {
  transports: ['websocket', 'polling'],
  withCredentials: true
});

// Event listeners
socket.on('receiveMessage', (message) => {
  // Add message to chat
});

socket.on('newNotification', (notification) => {
  // Update badge
});
```

**API Endpoints:**
```javascript
api.getConversations() // GET /api/chat/conversations
api.getMessages(partnerId) // GET /api/chat/:partnerId
api.sendMessage(receiverId, content) // POST /api/chat/send
```

**UI Structure:**
```jsx
<div className="chat-shell">
  <ConversationsList>
    <SearchBar />
    {conversations.map(conv => (
      <ConversationItem
        key={conv._id}
        conversation={conv}
        onClick={() => openChat(conv._id)}
      />
    ))}
  </ConversationsList>
  
  <ChatWindow>
    <ChatHeader />
    <MessagesList>
      {messages.map(msg => (
        <Message key={msg._id} message={msg} />
      ))}
    </MessagesList>
    <MessageInput onSend={sendMessage} />
  </ChatWindow>
</div>
```

**Reference:** `frontend/js/dashboard.js` (lines 1500-1700)

### 8. InvestorsProvidersPage

**File:** `frontend-react/src/components/founder/pages/InvestorsProvidersPage.jsx`

**Features:**
- 70% validation gate
- Investor list with search
- Provider list with search/filter by category
- Detail modals with full profile
- Connection request functionality
- Rating system
- Verified badges

**API Endpoints:**
```javascript
api.getInvestors(search) // GET /api/founder/investors?search=...
api.getProviders(search, category) // GET /api/founder/providers?search=...&category=...
api.getInvestorDetail(id) // GET /api/founder/investors/:id
api.getProviderDetail(id) // GET /api/founder/providers/:id
api.sendRequest(providerId, message) // POST /api/founder/send-request
api.rateProfile(profileId, rating) // POST /api/founder/rate/:profileId
```

**UI Structure:**
```jsx
<GateMessage /> {/* If validation < 70% */}
<InvestorsSection>
  <SearchBar />
  <InvestorGrid>
    {investors.map(inv => (
      <ProfileCard
        key={inv._id}
        profile={inv}
        onClick={() => openDetailModal(inv)}
      />
    ))}
  </InvestorGrid>
</InvestorsSection>

<ProvidersSection>
  <SearchBar />
  <CategoryFilter />
  <ProviderGrid>
    {providers.map(prov => (
      <ProfileCard
        key={prov._id}
        profile={prov}
        onClick={() => openDetailModal(prov)}
        onRequest={() => sendRequest(prov)}
      />
    ))}
  </ProviderGrid>
</ProvidersSection>

<DetailModal>
  <ProfileDetails />
  <RatingSection />
  <ActionButtons /> {/* Connect / Chat / Pending */}
</DetailModal>
```

### 9. RequestsPage

**File:** `frontend-react/src/components/founder/pages/RequestsPage.jsx`

**Features:**
- Incoming requests list
- Sent requests list
- Accept/reject actions
- Real-time updates via Socket.io
- Badge counts

**API Endpoints:**
```javascript
api.getIncomingRequests() // GET /api/founder/requests
api.getSentRequests() // GET /api/founder/sent-requests
api.acceptRequest(requestId) // PUT /api/founder/requests/:id/accept
api.rejectRequest(requestId) // PUT /api/founder/requests/:id/reject
```

**Socket.io Events:**
```javascript
socket.on('newRequest', (data) => {
  // Refresh incoming requests
  // Update badge count
});

socket.on('requestStatusUpdate', (data) => {
  // Refresh sent requests
});
```

### 10. AnalyticsPage

**File:** `frontend-react/src/components/founder/pages/AnalyticsPage.jsx`

**Features:**
- Stats cards (validation score, progress, tasks)
- Stage performance radar chart
- Task completion doughnut chart
- Chart.js integration

**API Endpoints:**
```javascript
api.getAnalytics() // GET /api/founder/analytics
```

**Chart.js Integration:**
```javascript
import { Chart } from 'chart.js/auto';

// Radar Chart
new Chart(ctx, {
  type: 'radar',
  data: {
    labels: ['Idea', 'Problem', 'Solution', 'Market', 'Business'],
    datasets: [{
      label: 'Score',
      data: [80, 90, 70, 85, 75],
      backgroundColor: 'rgba(212,255,0,0.15)',
      borderColor: '#D4FF00'
    }]
  }
});

// Doughnut Chart
new Chart(ctx, {
  type: 'doughnut',
  data: {
    labels: ['Completed', 'Pending'],
    datasets: [{
      data: [8, 7],
      backgroundColor: ['#34d399', 'rgba(255,255,255,0.08)']
    }]
  }
});
```

## 🔧 TECHNICAL SETUP

### Socket.io Client Setup

**File:** `frontend-react/src/services/socket.js`

```javascript
import io from 'socket.io-client';

const SOCKET_URL = 'https://api.dolphinorg.in';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(userId) {
    if (this.socket) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000,
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.socket.emit('join', userId);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket connection failed:', err.message);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }
}

export default new SocketService();
```

**Usage in Components:**
```javascript
import socket from '../../../services/socket';

useEffect(() => {
  if (user?._id) {
    socket.connect(user._id);

    socket.on('receiveMessage', handleNewMessage);
    socket.on('newRequest', handleNewRequest);
    socket.on('newNotification', handleNewNotification);

    return () => {
      socket.disconnect();
    };
  }
}, [user]);
```

### API Service Methods to Add

**File:** `frontend-react/src/services/api.js`

Add these methods:
```javascript
// Roadmap
getRoadmap: () => api.get('/founder/roadmap'),
completeRoadmapTask: (taskKey) => api.post(`/founder/roadmap/complete/${taskKey}`),

// Posts
getPosts: (page = 1, filter = 'all') => api.get(`/posts?page=${page}&filter=${filter}`),
createPost: (formData) => api.post('/posts', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
}),
likePost: (postId) => api.post(`/posts/${postId}/like`),
deletePost: (postId) => api.delete(`/posts/${postId}`),

// Chat
getConversations: () => api.get('/chat/conversations'),
getMessages: (partnerId) => api.get(`/chat/${partnerId}`),
sendMessage: (receiverId, content) => api.post('/chat/send', { receiverId, content }),

// Investors & Providers
getInvestors: (search = '') => api.get(`/founder/investors?search=${search}`),
getProviders: (search = '', category = 'all') => 
  api.get(`/founder/providers?search=${search}&category=${category}`),
getInvestorDetail: (id) => api.get(`/founder/investors/${id}`),
getProviderDetail: (id) => api.get(`/founder/providers/${id}`),
sendRequest: (providerId, message) => 
  api.post('/founder/send-request', { providerId, message }),
rateProfile: (profileId, rating) => 
  api.post(`/founder/rate/${profileId}`, { rating }),

// Requests
getIncomingRequests: () => api.get('/founder/requests'),
getSentRequests: () => api.get('/founder/sent-requests'),
acceptRequest: (requestId) => api.put(`/founder/requests/${requestId}/accept`),
rejectRequest: (requestId) => api.put(`/founder/requests/${requestId}/reject`),

// Analytics
getAnalytics: () => api.get('/founder/analytics'),

// Settings
uploadProfilePicture: (formData) => api.post('/auth/upload-profile-picture', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
}),
updatePassword: (data) => api.put('/auth/password', data),
deleteAccount: () => api.delete('/auth/account')
```

## 🚀 DEPLOYMENT CHECKLIST

### Before Deployment:
- [ ] All pages implemented
- [ ] All features tested
- [ ] Mobile responsive verified
- [ ] Socket.io working
- [ ] API endpoints tested
- [ ] Error handling in place
- [ ] Loading states implemented
- [ ] Toast notifications working
- [ ] Security measures verified
- [ ] Performance optimized

### Deployment Steps:
1. Build React app: `npm run build`
2. Test build locally: `npm run preview`
3. Deploy to Vercel subdomain: `app.dolphin-main.vercel.app`
4. Configure environment variables
5. Test on subdomain
6. Verify zero impact on main deployment

### Environment Variables:
```env
VITE_API_URL=https://api.dolphinorg.in/api
VITE_SOCKET_URL=https://api.dolphinorg.in
```

## 📚 RESOURCES

### Reference Files:
- HTML: `frontend/dashboard.html`, `frontend/investor-dashboard.html`, etc.
- JavaScript: `frontend/js/dashboard.js`, `frontend/js/posts.js`, etc.
- CSS: `frontend/css/founderDashboard.css`, `frontend/css/feed.css`, etc.

### Documentation:
- React: https://react.dev
- React Router: https://reactrouter.com
- React Query: https://tanstack.com/query
- Socket.io: https://socket.io/docs/v4/client-api/
- Chart.js: https://www.chartjs.org/docs/latest/

## 💡 TIPS

1. **Copy HTML Structure**: Use the HTML as a blueprint for JSX
2. **Reuse Logic**: Copy JavaScript functions and adapt to React hooks
3. **Use Existing Styles**: CSS classes are already defined
4. **Test Incrementally**: Test each feature as you build it
5. **Handle Errors**: Always add try-catch and toast notifications
6. **Show Loading**: Use LoadingSpinner for async operations
7. **Mobile First**: Test on mobile viewport frequently
8. **Socket Events**: Set up listeners in useEffect with cleanup
9. **Cache Data**: Use localStorage for performance
10. **Follow Patterns**: Look at completed pages for examples

## 🎯 ESTIMATED TIME

- **TasksPage**: 1 hour
- **PostsPage**: 2-3 hours (complex with media upload)
- **ChatPage**: 2-3 hours (Socket.io integration)
- **InvestorsProvidersPage**: 2 hours
- **RequestsPage**: 1 hour
- **AnalyticsPage**: 1-2 hours (Chart.js)
- **Other Dashboards**: 4-5 hours each

**Total Remaining**: 15-20 hours of focused work

Good luck! 🚀
