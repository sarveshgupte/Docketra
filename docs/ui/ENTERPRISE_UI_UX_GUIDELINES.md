# Docketra Enterprise UI/UX Guidelines

## Design Theme: Structured Professionalism

This document defines the UI/UX architecture for Docketra, a B2B SaaS platform for legal, compliance, and consulting firms handling sensitive data.

---

## Non-Negotiable Principles

### 1. Enterprise-First Design
- **NO** playful UI elements
- **NO** consumer app patterns
- **NO** excessive animations
- **NO** novelty components
- Professional, serious, and trustworthy aesthetic at all times

### 2. Predictability Over Creativity
- Use familiar SaaS patterns
- Maintain clear information hierarchy
- Ensure obvious affordances
- Users should never guess how something works

### 3. Scalability
- Must support additional modules without redesign
- Avoid page-specific hardcoded styles
- Use reusable component system
- Design for growth

### 4. Role Awareness
- **Admin views**: Dense information layouts
- **Regular users**: Simplified, task-focused interfaces
- **Clients**: Read-only clarity with trust indicators

---

## Color System

### Primary Colors
```
Primary-600: #0F172A (Main brand, headers, primary text)
Primary-500: #334155 (Secondary brand elements)
```

### Surface Colors
```
Surface-Base: #F8FAFC (Page background)
Surface-Card: #FFFFFF (Card and modal backgrounds)
```

### Border Colors
```
Border-Subtle: #E2E8F0 (Light borders)
Border-Strong: #CBD5E1 (Strong borders, dividers)
```

### Text Colors
```
Text-Main: #0F172A (Primary text)
Text-Body: #475569 (Body text)
Text-Muted: #94A3B8 (Helper text, metadata)
```

### Semantic Colors
```
Success: #059669 (Confirmations, positive states)
Warning: #D97706 (Warnings, pending states)
Danger: #DC2626 (Errors, destructive actions)
Info: #2563EB (Information, links)
```

**Rules:**
- Use semantic colors **only** for their intended purpose
- Never use semantic colors for decoration
- Maintain WCAG AA contrast ratios (4.5:1 minimum for text)

---

## Typography System

### Font Family
**Inter** (fallback: system-ui, -apple-system, sans-serif)

### Type Scale
```
H1: 24px / 600 weight (Page titles)
H2: 18px / 500 weight (Section headers)
Body: 14px / 400 weight (Default text)
Small: 12px / 400 weight (Metadata, helpers)
```

**Rules:**
- Use type hierarchy consistently
- Never use more than 2 font weights per page
- Line height: 1.5 for body text, 1.2 for headings
- Never use font sizes smaller than 12px

---

## Spacing System

**Base Unit:** 4px

**Scale:**
```
4px  (xs) - Tight spacing within components
8px  (sm) - Component internal padding
16px (md) - Standard gap between elements
24px (lg) - Section spacing
32px (xl) - Major section dividers
```

**Rules:**
- Always use multiples of 4px
- Never use arbitrary spacing values
- Maintain consistent spacing within component types

---

## Layout Architecture

### Global Layout Structure

```
┌─────────────────────────────────────────────┐
│  Fixed Sidebar  │  Sticky Header            │
│                 ├───────────────────────────┤
│  - Logo         │  Content Area             │
│  - Navigation   │  (Surface-Base background)│
│  - Settings     │  - White cards            │
│                 │  - Borders over shadows   │
└─────────────────┴───────────────────────────┘
```

### Fixed Sidebar (Left)
- **Width:** 240px
- **Position:** Fixed
- **Collapsible:** Yes
- **Contents:**
  - Logo (top)
  - Primary navigation (middle)
  - Settings/Help (bottom)
- **Active state:** Subtle background + left accent bar

### Sticky Header (Top)
- **Height:** 64px
- **Background:** White
- **Shadow:** Subtle border-bottom
- **Contents:**
  - Breadcrumbs (left)
  - Global search with Cmd+K (center)
  - Notifications + User menu (right)

### Content Area
- **Background:** Surface-Base (#F8FAFC)
- **Padding:** 24px
- **All content in white cards**
- **Use borders, not shadows**

---

## Component Library

### Button Component

**Variants:**
- **Primary:** Solid Primary-600 background, white text
- **Secondary:** Border with Primary-600, Primary-600 text
- **Danger:** Solid Danger color, white text

**States:**
- Default
- Hover (subtle background change)
- Active (pressed state)
- Disabled (reduced opacity, no cursor)
- Loading (spinner, disabled interaction)

**Specs:**
- Border radius: 6px
- Padding: 8px 16px
- Min height: 36px
- Font weight: 500

**Rules:**
- Never use pill-shaped buttons
- Always provide loading states for async actions
- Disabled buttons must be visually distinct
- Primary actions use primary buttons, everything else uses secondary

### Input Component

**Types:**
- Text
- Email
- Password
- Number
- Select
- Textarea

**States:**
- Default
- Focus (visible focus ring)
- Error (red border, error message below)
- Disabled (read-only text, not disabled input)
- Success (green border for validation)

**Specs:**
- Border radius: 6px
- Border: 1px solid Border-Subtle
- Padding: 8px 12px
- Min height: 40px
- Focus ring: 2px Info color

**Rules:**
- Always show validation messages inline below input
- Validate on blur, not on every keystroke
- Use placeholder text sparingly
- Read-only fields render as static text, not disabled inputs

### Card Component

**Structure:**
```jsx
<Card>
  <CardHeader title="Title" action={optional} />
  <CardBody>Content</CardBody>
  <CardFooter>Optional footer</CardFooter>
</Card>
```

**Specs:**
- Background: White
- Border: 1px solid Border-Subtle
- Border radius: 8px
- Padding: 16px
- Shadow: None (borders only)

**Rules:**
- Cards are the primary content container
- Never nest cards more than 2 levels deep
- Use consistent padding across all cards

### Table Component

**Features:**
- Sticky header
- Zebra striping (very subtle, alternating rows)
- Bulk selection (checkbox in first column)
- Action column pinned right
- Pagination at bottom

**Specs:**
- Header background: Surface-Base
- Header font: 12px / 600 weight
- Row padding: 12px 16px
- Row hover: Subtle background
- Border: 1px solid Border-Subtle

**Rules:**
- Never hide actions in dropdown menus
- Always show most important columns first
- Pagination shows: "Showing X-Y of Z results"
- Support sorting on key columns

### Badge Component

**Style:** Pill-shaped

**Types:**
- Success (green)
- Warning (orange)
- Danger (red)
- Info (blue)
- Neutral (gray)

**Specs:**
- Border radius: 12px (pill)
- Padding: 4px 12px
- Font size: 12px / 500 weight
- Background: Light tint of semantic color
- Text: Dark shade of semantic color

**Rules:**
- Use semantic colors only
- Keep text short (1-2 words max)
- Always convey status, not decoration

### Toast Notification System

**Types:**
- Success: Auto-dismiss after 3 seconds
- Error: Persistent until user dismisses
- Warning: Auto-dismiss after 5 seconds
- Info: Auto-dismiss after 4 seconds

**Position:** Top-right corner

**Specs:**
- Width: 320px
- Padding: 16px
- Border radius: 8px
- Border-left: 4px solid semantic color
- Background: White
- Shadow: Medium elevation

**Rules:**
- Never show more than 3 toasts simultaneously
- Stack vertically with 8px gap
- Always include close button
- Animations must be subtle (fade in/out)

---

## Page-Level UX Patterns

### Dashboard
- **KPI cards at top:** 3-4 key metrics
- **Every metric clickable:** Navigates to filtered list
- **Clear priority:** "What needs attention" section
- **Recent activity:** Last 5-10 items
- **Dense but scannable:** Admin dashboard can be information-rich

### List Pages (Cases, Users, Clients)
- **Title left, primary action right:** Clear hierarchy
- **Filter/sort toolbar above table:** Always visible
- **No hidden actions:** All actions in action column
- **Bulk actions:** Available when items selected
- **Empty states:** Helpful messaging with action

### Detail Views
- **Header:** Title + status badge + primary action
- **Tabs below header:** For different sections
- **Metadata:** Label:value format in consistent grid
- **Audit strip at bottom:**
  - Created by
  - Created at
  - Last updated by
  - Last updated at

### Create/Edit Flows
- **Simple forms:** Use modal (max 5-6 fields)
- **Complex forms:** Use right-side drawer or full page
- **Validation:** On blur, show errors inline
- **Save states:** Show loading on button
- **Success:** Toast + redirect or stay with refresh

---

## Trust & Safety UX

### Audit Visibility
- Always show who created and when
- Always show who last modified and when
- Show version history when available
- Never hide audit trails

### Destructive Actions
- Require explicit confirmation
- Show what will be deleted/removed
- Use danger button styling
- Provide undo when possible

### Read-Only Fields
- Render as static text, not disabled inputs
- Include lock icon or "read-only" label
- Explain why field is read-only

### Error Handling
- Never fail silently
- Always show user-friendly error messages
- Provide recovery actions when possible
- Log technical errors for support

### Action Feedback
- Every action gets immediate feedback
- Loading states for async operations
- Success/error toasts for results
- Optimistic UI updates when appropriate

---

## Accessibility Requirements

### WCAG AA Compliance
- Text contrast: 4.5:1 minimum
- Large text contrast: 3:1 minimum
- Non-text contrast: 3:1 minimum
- Test all color combinations

### Keyboard Navigation
- All interactive elements focusable
- Visible focus indicators (2px ring)
- Logical tab order
- Support keyboard shortcuts for common actions

### Click Targets
- Minimum size: 44x44px
- Adequate spacing between targets
- Larger targets for primary actions

### Semantic HTML
- Use proper heading hierarchy
- Use button elements for buttons
- Use form elements correctly
- Include ARIA labels when needed

---

## Implementation Rules

### CSS Architecture
1. Use Tailwind CSS for utility classes
2. Create custom components for reusable patterns
3. Never use inline styles
4. Never use CSS-in-JS for styles
5. Organize by component, not by page

### Component Reusability
1. Build once, use everywhere
2. Props over variants
3. Compose small components into larger ones
4. Document props and usage

### Code Quality
1. No TODOs in production code
2. No commented-out code
3. Consistent naming conventions
4. Clear component documentation

---

## Testing Guidelines

### Visual Testing
- Test in Chrome, Firefox, Safari
- Test responsive breakpoints
- Test with browser zoom (100%, 150%, 200%)
- Test dark mode (if supported)

### Accessibility Testing
- Use keyboard only to navigate
- Test with screen reader
- Check color contrast with tools
- Validate HTML semantics

### User Testing
- Admin users: Dense layouts work?
- Regular users: Can complete tasks?
- Client users: Clear read-only states?

---

## Migration Strategy

### Phase 1: Foundation
- Set up new design tokens
- Create core components
- Update layout structure

### Phase 2: Page-by-Page Migration
- Dashboard first
- List pages next
- Detail pages
- Forms last

### Phase 3: Polish
- Remove old styles
- Fix inconsistencies
- Performance optimization
- Final QA

---

## Conclusion

This design system is **locked**. Any deviations must be approved and documented. Consistency is more important than individual preferences.

The goal is a **calm, predictable, professional** interface that serves users handling sensitive data. Design and implement accordingly.
