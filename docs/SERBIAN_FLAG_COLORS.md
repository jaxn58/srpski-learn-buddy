# Serbian Flag Colors - Design System

## Overview

This document describes the implementation of Serbian flag colors (Blue and Red with gradients) throughout the application.

## Color Values

### Serbian Blue (Primary)
- **From**: `#0C4076` (Dark Serbian Blue)
- **To**: `#1a5a9e` (Light Serbian Blue)
- **Gradient**: `bg-gradient-to-br from-[#0C4076] to-[#1a5a9e]`

### Serbian Red (Destructive/Alert)
- **From**: `#C6363C` (Serbian Red)
- **To**: `#a82329` (Dark Serbian Red)
- **Gradient**: `bg-gradient-to-br from-[#C6363C] to-[#a82329]`

## Implementation

### 1. CSS Custom Properties

Located in `client/src/index.css`:

```css
:root {
  --serbian-blue-from: #0C4076;
  --serbian-blue-to: #1a5a9e;
  --serbian-red-from: #C6363C;
  --serbian-red-to: #a82329;
}
```

### 2. Button Component

The Button component (`client/src/components/ui/button.tsx`) has been updated with new variants:

#### Default Variant (Blue)
```tsx
<Button variant="default">Click Me</Button>
// Uses Serbian Blue gradient
```

#### Destructive Variant (Red)
```tsx
<Button variant="destructive">Delete</Button>
// Uses Serbian Red gradient
```

#### Explicit Blue Variant
```tsx
<Button variant="blue">Blue Action</Button>
// Same as default, but explicit
```

#### Explicit Red Variant
```tsx
<Button variant="red">Red Action</Button>
// Same as destructive, but explicit
```

### 3. Cards and UI Elements

#### Progress Page Cards

**Level Card (Blue)**:
```tsx
<Card className="bg-gradient-to-br from-[#0C4076] to-[#1a5a9e] text-white">
  {/* Content */}
</Card>
```

**Streak Card (Red)**:
```tsx
<Card className="bg-gradient-to-br from-[#C6363C] to-[#a82329] text-white">
  {/* Content */}
</Card>
```

## Usage Guidelines

### When to Use Blue
- Primary actions (Submit, Save, Continue)
- Information displays (Level, Stats)
- Navigation elements
- Default buttons

### When to Use Red
- Destructive actions (Delete, Remove, Cancel)
- Warnings and alerts
- Error states
- Streak/motivation elements

### Gradient Direction
- **Standard**: `bg-gradient-to-br` (bottom-right)
- Creates depth and visual interest
- Consistent across all components

## Migration Guide

### Updating Existing Components

**Before:**
```tsx
<Button className="bg-blue-600 hover:bg-blue-700">
  Click Me
</Button>
```

**After:**
```tsx
<Button variant="default">
  Click Me
</Button>
```

**Before:**
```tsx
<Button className="bg-red-600 hover:bg-red-700">
  Delete
</Button>
```

**After:**
```tsx
<Button variant="destructive">
  Delete
</Button>
```

### Custom Cards

**Before:**
```tsx
<Card className="bg-blue-600 text-white">
  Content
</Card>
```

**After:**
```tsx
<Card className="bg-gradient-to-br from-[#0C4076] to-[#1a5a9e] text-white">
  Content
</Card>
```

## Benefits

1. **Consistent Branding**: Serbian flag colors throughout the app
2. **Visual Depth**: Gradients add dimension and polish
3. **Accessibility**: High contrast ratios maintained
4. **Maintainability**: Centralized color definitions
5. **Cultural Identity**: Reinforces Serbian language learning theme

## Files Modified

- `client/src/index.css` - Added CSS custom properties
- `client/src/components/ui/button.tsx` - Updated button variants
- `client/src/pages/Progress.tsx` - Updated cards with gradients

## Future Considerations

- Consider adding gradient variants for other UI components (badges, alerts)
- Explore using CSS custom properties for gradient definitions
- Add dark mode support for gradients
- Consider animation/transition effects on hover

## Testing

Test the new colors across:
- [ ] All button variants
- [ ] Progress page cards
- [ ] Different screen sizes
- [ ] Light and dark modes
- [ ] Accessibility (contrast ratios)

## References

- Serbian Flag: [Wikipedia](https://en.wikipedia.org/wiki/Flag_of_Serbia)
- Color Accessibility: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
