# CLAUDE.md — Product Designer Portfolio Website

## Project Overview

Build a **minimal, elegant personal portfolio website** for a UX/UI product designer.
The site should feel crafted and intentional — not templated or generic.

---

## Pages to Build

### 1. Landing Page (`index.html`)
The main portfolio page. Should include:
- **Hero section** — Name, title, one-line positioning statement
- **Work grid** — Project thumbnails with hover effects and image expand (Dribbble-inspired)
- **About section** — Short bio, skills, tools used
- **Contact / Footer** — Email, LinkedIn, minimal footer

### 2. Case Study Template Page (`case-study.html`)
A reusable template for individual project write-ups. Should include:
- **Project header** — Title, role, timeline, tools
- **Long-form body content** — Medium-inspired typography for comfortable reading
- **Image carousel / full-width image sections** — For showcasing designs
- **Next project** — Link to next case study at the bottom

---

## Design Direction

### Inspiration
- **Dribbble** — Image interaction style: expandable project images, smooth hover reveals, carousels
- **Medium** — Text layout: generous line-height, comfortable reading width (~680px max), clean typographic hierarchy

### Aesthetic
- Minimal and elegant — lots of white space, restrained color palette
- Typography-first — choose a distinctive, refined font pairing (avoid Inter, Roboto, Arial)
- Subtle motion — hover states, image reveals, smooth scroll transitions
- No clutter — every element earns its place on the page

### Color
- Use a neutral base (white or off-white background)
- One accent color — used sparingly for links, hover states, or highlights
- Dark text for readability (not pure black — use a soft dark tone)

### Typography
- Display / heading font: something with personality (e.g. serif, editorial feel)
- Body font: clean and highly legible for long reads
- Body text size: 18–20px, line-height: 1.7–1.8

---

## Technical Rules

### Code Style
- **Simple and readable** — prioritize clarity over cleverness
- Use plain **HTML + CSS + vanilla JS** unless a specific library is needed
- No unnecessary frameworks or dependencies
- CSS variables for all colors, fonts, spacing — easy to customize
- Mobile responsive from the start

### File Structure
```
/
├── index.html          # Landing page
├── case-study.html     # Case study template
├── style.css           # Shared styles
├── main.js             # Shared JS (lightbox, carousel, scroll effects)
└── assets/
    └── images/         # Placeholder or real images
```

### Interactions to Implement
- **Image lightbox / expand** — Click project image to expand fullscreen (Dribbble-style)
- **Project image carousel** — For case study pages, swipeable/clickable image gallery
- **Hover reveals** — Subtle overlay on project cards showing title/category
- **Smooth scroll** — Between sections on landing page
- **Scroll-triggered fade-ins** — Sections appear as user scrolls down

---

## Content Placeholders

Use realistic placeholder content throughout:
- Designer name: `[Your Name]`
- Project titles: Use realistic UX project names (e.g. "Redesigning Onboarding for FinTech App")
- Images: Use `https://picsum.photos` for placeholder images
- Bio: Write a short, professional-sounding 2–3 sentence placeholder bio

---

## What to Avoid
- Generic AI-looking design (purple gradients, cookie-cutter layouts)
- Overused fonts (Inter, Roboto, Arial, Space Grotesk)
- Heavy JavaScript frameworks unless truly necessary
- Overly complex animations that distract from the content
- Cluttered layouts — when in doubt, add more space

---

## Goal

When complete, the site should feel like it was **designed by the designer themselves** —
not built from a template. It should be something a UX/UI professional would be proud to share.
