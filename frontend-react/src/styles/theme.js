// Dolphin Theme - Balanced Light Theme (Not too light, not too dark)
export const theme = {
  // Colors - Balanced light theme
  colors: {
    // Backgrounds - Soft, not harsh white
    bg: '#F8FAFC',           // Very light blue-gray (main background)
    bgSurface: '#FFFFFF',    // Pure white for cards
    bgHover: '#F1F5F9',      // Slight hover state
    bgSubtle: '#E2E8F0',     // Subtle backgrounds
    
    // Text - Good contrast but not harsh black
    textPrimary: '#0F172A',      // Dark slate (main text)
    textSecondary: '#475569',    // Medium slate
    textTertiary: '#94A3B8',     // Light slate
    textFaint: '#CBD5E1',        // Very light slate
    
    // Primary - Vibrant lime green (brand color)
    primary: '#84CC16',          // Lime 500
    primaryHover: '#65A30D',     // Lime 600
    primaryLight: '#BEF264',     // Lime 300
    primaryBg: '#ECFCCB',        // Lime 50
    primaryDim: '#D9F99D',       // Lime 200
    
    // Secondary - Blue accent
    secondary: '#3B82F6',        // Blue 500
    secondaryHover: '#2563EB',   // Blue 600
    secondaryLight: '#60A5FA',   // Blue 400
    secondaryBg: '#DBEAFE',      // Blue 50
    
    // Borders
    border: '#E2E8F0',           // Slate 200
    borderHover: '#CBD5E1',      // Slate 300
    borderStrong: '#94A3B8',     // Slate 400
    
    // Status colors
    success: '#10B981',          // Green 500
    successBg: '#D1FAE5',        // Green 50
    warning: '#F59E0B',          // Amber 500
    warningBg: '#FEF3C7',        // Amber 50
    error: '#EF4444',            // Red 500
    errorBg: '#FEE2E2',          // Red 50
    info: '#3B82F6',             // Blue 500
    infoBg: '#DBEAFE',           // Blue 50
  },
  
  // Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },
  
  // Border radius
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    full: '9999px',
  },
  
  // Shadows - Softer shadows for light theme
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  },
  
  // Typography
  fonts: {
    body: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  
  fontSizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
    '6xl': '3.75rem', // 60px
  },
  
  fontWeights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  
  // Transitions
  transitions: {
    fast: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    base: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    slow: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  
  // Z-index
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
};

export default theme;
