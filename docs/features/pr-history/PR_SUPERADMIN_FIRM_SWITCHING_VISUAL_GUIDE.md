# SuperAdmin Firm Switching - Visual Guide

## 🎨 UI Components Overview

This document provides a visual description of the SuperAdmin firm switching UI components.

## 1. FirmSwitcher Component

### Location
Top navigation bar, right side, between navigation links and user info

### Visual Appearance
- **Button**: Blue primary button with text "Switch to Firm"
- **Dropdown**: White card with shadow, appears below button when clicked
- **Dimensions**: 320px wide minimum, max 400px
- **Animation**: Smooth slide-down animation (0.2s)

### Dropdown Structure

```
┌──────────────────────────────────────┐
│  Select a Firm                    ×  │ ← Header with close button
├──────────────────────────────────────┤
│  Test Firm                           │ ← Firm item (clickable)
│  FIRM001 • test-firm                 │
├──────────────────────────────────────┤
│  Another Firm                        │
│  FIRM002 • another-firm              │
├──────────────────────────────────────┤
│  ...                                 │
└──────────────────────────────────────┘
```

### States
- **Default**: Button visible, dropdown hidden
- **Loading**: Button shows "Loading...", disabled
- **Open**: Dropdown visible with backdrop overlay
- **Hover**: List items highlight on hover (#f8f9fa)
- **Empty**: Shows "No active firms available"

### Interaction Flow
1. Click "Switch to Firm" button
2. Dropdown appears with list of active firms
3. Click on a firm to switch
4. Success toast message appears
5. Dropdown closes automatically
6. ImpersonationBanner appears

## 2. ImpersonationBanner Component

### Location
Full-width sticky banner at the very top of the page, above navigation

### Visual Appearance
- **Background**: Red-orange gradient (linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%))
- **Text**: White, centered
- **Border**: 2px solid red (#ff5252) at bottom
- **Shadow**: Subtle drop shadow (0 2px 8px rgba(0,0,0,0.15))
- **Height**: Auto (12px padding top/bottom)

### Content Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🔒  You are impersonating Gupte OPC          [Exit Firm]       │
└─────────────────────────────────────────────────────────────────┘
```

### Elements
- **Lock Icon (🔒)**: 20px, pulsing animation
- **Text**: 14px font, bold firm name underlined
- **Exit Button**: Semi-transparent white button, hover effect

### Animations
- **Entrance**: Slides down from top (0.3s ease-out)
- **Lock Icon**: Continuous pulse (2s ease-in-out infinite)

### States
- **Active**: Banner visible when impersonating
- **Hidden**: No banner when in GLOBAL context
- **Hover**: Exit button becomes more opaque

### Interaction
- Click "Exit Firm" button
- Calls `/api/superadmin/exit-firm`
- Banner fades out
- Returns to GLOBAL context

## 3. SuperAdminLayout Integration

### Navigation Bar Layout

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  Docketra Platform [SuperAdmin]   Platform Dashboard | Firms      │
│                                                                    │
│                          [Switch to Firm] SUPERADMIN (SuperAdmin)  │
│                                          [Logout]                  │
└────────────────────────────────────────────────────────────────────┘
```

### With Impersonation Active

```
┌────────────────────────────────────────────────────────────────────┐
│  🔒  You are impersonating Test Firm          [Exit Firm]          │ ← Banner
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Docketra Platform [SuperAdmin]   Platform Dashboard | Firms      │
│                                                                    │
│                          [Switch to Firm] SUPERADMIN (SuperAdmin)  │
│                                          [Logout]                  │
└────────────────────────────────────────────────────────────────────┘
```

## 4. Color Scheme

### Impersonation Banner
- **Primary**: #ff6b6b (red-orange)
- **Secondary**: #ff8e53 (orange)
- **Border**: #ff5252 (bright red)
- **Text**: #ffffff (white)
- **Button Background**: rgba(255, 255, 255, 0.2)
- **Button Border**: rgba(255, 255, 255, 0.5)
- **Button Hover**: rgba(255, 255, 255, 0.3)

### FirmSwitcher Dropdown
- **Background**: #ffffff (white)
- **Text**: #333333 (dark gray)
- **Secondary Text**: #666666 (medium gray)
- **Hover**: #f8f9fa (light gray)
- **Border**: #e0e0e0 (border gray)
- **Shadow**: rgba(0, 0, 0, 0.15)

### Backdrop
- **Overlay**: rgba(0, 0, 0, 0.3)

## 5. Typography

### Impersonation Banner
- **Main Text**: 14px, font-weight: 500
- **Firm Name**: 14px, font-weight: 700, underlined
- **Button**: 14px, font-weight: 600

### FirmSwitcher
- **Header**: 16px, font-weight: 600
- **Firm Name**: 14px, font-weight: 600
- **Metadata**: 12px, normal weight

## 6. Responsive Behavior

### Desktop (> 768px)
- Full-width banner
- Dropdown aligned to right of button
- All elements visible

### Mobile (≤ 768px)
- Banner text may wrap
- Dropdown still 320px min-width
- May overflow on very small screens (consider horizontal scroll or smaller breakpoint)

## 7. Accessibility Features

### Keyboard Navigation
- Tab through components
- Enter to select firm
- Escape to close dropdown

### Screen Readers
- Descriptive button labels
- ARIA labels for icon-only buttons
- Clear state announcements

### Visual Indicators
- High contrast colors
- Clear focus states
- Pulsing animation for attention
- Prominent "Exit" action

## 8. User Experience Flow

### Starting State: GLOBAL Context

```
[SuperAdmin Dashboard]
    ↓
[Clicks "Switch to Firm"]
    ↓
[Dropdown appears with firm list]
    ↓
[Selects "Test Firm"]
    ↓
[Success toast: "Switched to firm context: Test Firm"]
    ↓
[Banner appears: "🔒 You are impersonating Test Firm [Exit Firm]"]
    ↓
[Can now access firm-scoped routes]
```

### Returning to GLOBAL Context

```
[Impersonating Test Firm]
    ↓
[Clicks "Exit Firm" in banner]
    ↓
[Success toast: "Returned to GLOBAL context"]
    ↓
[Banner disappears]
    ↓
[Back to SuperAdmin dashboard]
```

## 9. Error States

### Failed to Load Firms
- Toast message: "Failed to load active firms. Please try again or contact support if the problem persists."
- Dropdown shows: "No active firms available"

### Failed to Switch
- Toast message: "Failed to switch firm context. Please try again."
- Dropdown stays open for retry

### Failed to Exit
- Toast message: "Failed to exit firm context"
- Banner remains visible
- User can retry

## 10. Performance Considerations

### Initial Load
- Firms list fetched on component mount
- Cached for session
- No repeated API calls

### State Management
- localStorage for persistence
- React state for reactivity
- Automatic cleanup on logout

### Animations
- Hardware-accelerated transforms
- Debounced interactions
- Smooth 60fps animations

## Summary

The SuperAdmin firm switching UI is designed to be:
- **Visually Prominent**: Can't miss the red banner when impersonating
- **Easy to Use**: One click to switch, one click to exit
- **Safe**: Clear visual indicators prevent mistakes
- **Fast**: Smooth animations, minimal API calls
- **Accessible**: Keyboard navigation, screen reader support
- **Responsive**: Works on all screen sizes

The red/orange color scheme was specifically chosen to be attention-grabbing and indicate a "special mode" that requires caution.
