# Palette's Journal

## 2024-05-23 - Inaccessible Password Toggles
**Learning:** Found password visibility toggles implemented with `tabIndex={-1}` or as non-interactive elements, making them inaccessible to keyboard users.
**Action:** Always ensure password toggles are keyboard accessible buttons with `aria-label` and visible focus states.

## 2024-05-24 - Hidden Hover Actions
**Learning:** Poster overlay actions used `opacity-0 group-hover:opacity-100` which made them invisible to keyboard users when focused.
**Action:** Always add `group-focus-within:opacity-100` to hover-reveal containers to ensure keyboard accessibility.
