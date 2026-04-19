# Helio Design System Reference

This document serves as a reference for the design language and styling patterns used across the Helio application, ensuring consistency in any new pages or components.

## Typography
- **Primary Font:** Inter (sans-serif)
- **Logo/Brand:** Black weight (`font-black`), tight tracking (`tracking-tighter`), uppercase.
- **Headings:** Semibold (`font-semibold`), tight tracking (`tracking-tight`), dark text (`text-neutral-900`).
- **Body Text:** Neutral text (`text-neutral-600`), relaxed line height (`leading-relaxed`).

## Colors
- **Primary Accent:** Yellow-400 (`bg-yellow-400`, `#facc15`) - Used for primary buttons, logo accents, and highlights.
- **Hover States:** Yellow-500 (`hover:bg-yellow-500`, `#eab308`) for buttons.
- **Backgrounds:** 
  - Main areas: White (`bg-white`)
  - Alternate sections: Neutral-50 (`bg-neutral-50`)
  - Dark sections (like footer): Neutral-900 (`bg-neutral-900`)
- **Text Colors:** 
  - Primary: Neutral-900 (`text-neutral-900`)
  - Secondary: Neutral-600 (`text-neutral-600`)
  - Muted/Footer: Neutral-400 (`text-neutral-400`)

## Layout & Spacing
- **Main Container:** `max-w-7xl mx-auto px-6 lg:px-8`
- **Section Padding:** Generous vertical padding (`py-20 sm:py-28`)
- **Border Radius:** 
  - Large cards/containers: `rounded-2xl`
  - Media/inner elements: `rounded-xl`
  - Buttons/inputs: `rounded-md`

## Interaction & Animation
- **Transitions:** Smooth transitions on all interactive elements (`transition-all duration-300`).
- **Hover Effects (Cards):** Cards lift slightly with a shadow (`hover:shadow-lg`) and get a subtle border highlight (`hover:border-yellow-400/50`).
- **Buttons:** Solid yellow background with neutral-900 text, transitioning to a slightly darker yellow on hover (`hover:bg-yellow-500`).
- **Links:** Text links transition colors smoothly (`hover:text-yellow-400` or `hover:text-neutral-900`).