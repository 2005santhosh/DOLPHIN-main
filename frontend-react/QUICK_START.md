# 🚀 Quick Start Guide - React App

## Getting Started

### 1. Install Dependencies
```bash
cd frontend-react
npm install
```

### 2. Configure Environment
Create a `.env` file:
```env
VITE_API_URL=https://api.dolphinorg.in/api
```

### 3. Start Development Server
```bash
npm run dev
```

Visit: `http://localhost:5174`

---

## 📁 Project Structure

```
frontend-react/
├── src/
│   ├── components/
│   │   ├── auth/              # Login, Register, ForgotPassword, ResetPassword
│   │   ├── founder/           # Founder dashboard
│   │   │   ├── FounderDashboard.jsx
│   │   │   └── pages/         # All 10 dashboard pages
│   │   ├── investor/          # Investor dashboard (placeholder)
│   │   ├── provider/          # Provider dashboard (placeholder)
│   │   ├── admin/             # Admin dashboard (placeholder)
│   │   └── shared/            # Reusable components
│   ├── context/
│   │   └── AuthContext.jsx    # Authentication state
│   ├── services/
│   │   └── api.js             # API client with all endpoints
│   ├── styles/
│   │   ├── GlobalStyles.css   # Global styles
│   │   ├── landing.css        # Landing page styles
│   │   └── theme.js           # Theme configuration
│   ├── App.jsx                # Main app with routing
│   └── main.jsx               # Entry point
├── public/                    # Static assets
├── .env                       # Environment variables
├── package.json               # Dependencies
└── vite.config.js             # Vite configuration
```

---

## 🎯 Key Features

### Founder Dashboard Pages (All Complete)
1. **Dashboard** - Progress tracking, stats, validation roadmap
2. **Profile** - Startup information form
3. **Stages** - AI validation with 5 stages
4. **Tasks** - Growth roadmap with task completion
5. **Analytics** - Metrics and performance data
6. **Investors & Providers** - Browse and connect (70% validation required)
7. **Posts** - Create posts with media, infinite scroll, like/unlike
8. **Requests** - Manage incoming/sent connection requests
9. **Chat** - Real-time messaging with conversations
10. **Settings** - Account settings, password, profile picture

### Shared Components
- **Header** - Logo, points, notifications, user menu
- **Sidebar** - Navigation with active highlighting
- **Modal** - Flexible modal dialogs
- **Card** - Reusable card component
- **LoadingSpinner** - Loading states
- **PageHeader** - Page titles and subtitles
- **Toast** - Success/error notifications

---

## 🔧 Common Tasks

### Adding a New Page
1. Create component in `src/components/founder/pages/`
2. Import in `FounderDashboard.jsx`
3. Add to `renderPage()` switch statement
4. Add navigation item in `Sidebar.jsx`

### Adding an API Endpoint
1. Open `src/services/api.js`
2. Add method to appropriate API object (e.g., `founderAPI`)
3. Use in component with `await founderAPI.methodName()`

### Styling Components
- Use CSS variables from `GlobalStyles.css`
- Follow existing component patterns
- Use inline styles for dynamic values
- Add custom CSS classes when needed

### Handling Forms
```jsx
const [formData, setFormData] = useState({ field: '' });

const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await api.submitForm(formData);
    toast.success('Success!');
  } catch (error) {
    toast.error(error.message);
  }
};
```

### Using React Query
```jsx
const { data, isLoading, refetch } = useQuery({
  queryKey: ['key'],
  queryFn: api.getData,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

---

## 🎨 Design System

### Colors (CSS Variables)
```css
--primary: #D4FF00        /* Lime green */
--primary-dim: rgba(212, 255, 0, 0.15)
--success: #22C55E        /* Green */
--error: #EF4444          /* Red */
--warning: #F59E0B        /* Orange */
--info: #3B82F6           /* Blue */
--text-primary: #111827   /* Dark gray */
--text-secondary: #6B7280 /* Medium gray */
--text-tertiary: #9CA3AF  /* Light gray */
--bg-surface: #FFFFFF     /* White */
--bg-surface-2: #F9FAFB   /* Light gray */
--border-color: #E5E7EB   /* Border gray */
```

### Component Classes
```css
.btn                      /* Base button */
.btn-primary              /* Primary button */
.btn-secondary            /* Secondary button */
.btn-danger               /* Danger button */
.btn-sm                   /* Small button */
.btn-lg                   /* Large button */

.form-input               /* Text input */
.form-textarea            /* Textarea */
.form-select              /* Select dropdown */
.form-label               /* Form label */
.form-group               /* Form group wrapper */

.card                     /* Card container */
.list                     /* List container */
.list-item                /* List item */
.grid                     /* Grid layout */
```

---

## 🔒 Authentication

### Using Auth Context
```jsx
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  
  // user: Current user object
  // isAuthenticated: Boolean
  // login(email, password): Login function
  // logout(): Logout function
}
```

### Protected Routes
Already configured in `App.jsx`:
- Redirects to `/login` if not authenticated
- Redirects to appropriate dashboard if authenticated
- Role-based access control

---

## 📡 API Usage

### Making API Calls
```jsx
import { founderAPI } from '../services/api';

// Get data
const startup = await founderAPI.getMyStartup();

// Create/Update
await founderAPI.updateStartup({ name: 'New Name' });

// With error handling
try {
  const result = await founderAPI.submitValidation(data);
  toast.success('Success!');
} catch (error) {
  toast.error(error.message || 'Failed');
}
```

### Available API Objects
- `authAPI` - Authentication endpoints
- `founderAPI` - Founder-specific endpoints
- `postsAPI` - Posts and feed
- `chatAPI` - Messaging
- `notificationsAPI` - Notifications
- `investorAPI` - Investor endpoints
- `providerAPI` - Provider endpoints
- `adminAPI` - Admin endpoints

---

## 🐛 Debugging

### Common Issues

**1. API calls failing**
- Check `.env` file has correct `VITE_API_URL`
- Verify backend is running
- Check browser console for errors
- Verify token in localStorage

**2. Components not rendering**
- Check for console errors
- Verify imports are correct
- Check React DevTools for component tree

**3. Styles not applying**
- Check CSS variable names
- Verify class names match GlobalStyles.css
- Check for inline style conflicts

**4. Authentication issues**
- Clear localStorage: `localStorage.clear()`
- Check token expiration
- Verify backend auth endpoints

### Development Tools
- **React DevTools**: Inspect component tree and props
- **Network Tab**: Monitor API calls
- **Console**: Check for errors and logs
- **React Query DevTools**: Monitor cache and queries

---

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

Output: `dist/` folder

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables (Production)
Set in hosting platform:
- `VITE_API_URL`: Backend API URL

### Post-Deployment Checklist
- [ ] All pages load correctly
- [ ] API calls work
- [ ] Authentication works
- [ ] File uploads work
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Performance is good (Lighthouse score)

---

## 📚 Resources

### Documentation
- [React](https://react.dev/)
- [React Router](https://reactrouter.com/)
- [React Query](https://tanstack.com/query/latest)
- [Vite](https://vitejs.dev/)
- [Axios](https://axios-http.com/)

### Code Style
- Use functional components with hooks
- Prefer `const` over `let`
- Use async/await over promises
- Handle errors with try/catch
- Show loading states
- Provide user feedback (toasts)
- Keep components small and focused
- Extract reusable logic to custom hooks

---

## 💡 Tips

1. **Use React Query** for all API calls - automatic caching and refetching
2. **Show loading states** - users need feedback
3. **Handle errors gracefully** - show helpful error messages
4. **Optimize images** - compress before upload
5. **Test on mobile** - responsive design is critical
6. **Use TypeScript** (optional) - for better type safety
7. **Keep components small** - easier to maintain
8. **Reuse components** - DRY principle
9. **Use CSS variables** - consistent theming
10. **Document complex logic** - help future developers

---

## 🎉 You're Ready!

The React app is fully functional and production-ready. All features from the original HTML version have been implemented with improved architecture, better performance, and enhanced security.

**Happy coding!** 🚀

---

**Need Help?**
- Check `REACT_MIGRATION_COMPLETE.md` for detailed implementation notes
- Review existing components for patterns
- Check browser console for errors
- Use React DevTools for debugging
