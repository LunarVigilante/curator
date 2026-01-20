# Palette's Journal

## 2024-05-23 - Inaccessible Password Toggles
**Learning:** Found password visibility toggles implemented with `tabIndex={-1}` or as non-interactive elements, making them inaccessible to keyboard users.
**Action:** Always ensure password toggles are keyboard accessible buttons with `aria-label` and visible focus states.
