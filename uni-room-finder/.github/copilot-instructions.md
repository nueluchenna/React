# Neuland Frontend - AI Coding Instructions

## Project Overview
**Neuland Frontend** is a React + Vite community platform for agricultural knowledge sharing in Germany, built with Tailwind CSS. The platform hosts discussions, articles, and resources for farmers, gardeners, and agricultural professionals.

## Architecture & Components

### Layout Structure
- **Header** ([src/components/header.jsx](src/components/header.jsx)): Navigation bar with logo, search, auth button; nav links include "INSPIRATION", "INFORMATION", "VERANSTALTUNGEN", "UNTERSTÜTZUNG", "NETZWERK", "ÜBER UNS", "KONTAKT"
- **Hero Section** ([src/components/hero.jsx](src/components/hero.jsx)): Landing page banner component
- **ForumLayout** ([src/layout/formLayout.jsx](src/layout/formLayout.jsx)): Main content wrapper for question/discussion listings
- **BottomNav** ([src/components/bottomNav.jsx](src/components/bottomNav.jsx)): Mobile/footer navigation
- **Footer** ([src/components/footer.jsx](src/components/footer.jsx)): Page footer

### Content Components
- **PostCard** ([src/components/commentcard.jsx](src/components/commentcard.jsx)): Community discussion card showing author (name, role, location), timestamp, content, tags, likes, and comments count
- **ProfileCard** ([src/components/profilecard.jsx](src/components/profilecard.jsx)): User profile mini-display (reused in PostCard header)
- **QuestionList** ([src/components/questionList.jsx](src/components/questionList.jsx)): List container for forum posts
- **TopicGrid** ([src/components/topicGrid.jsx](src/components/topicGrid.jsx)): Grid of topic categories
- **SubscriptionBanner** ([src/components/subscriptionBanner.jsx](src/components/subscriptionBanner.jsx)): Newsletter/subscription CTA
- **Breadcrumb** ([src/components/Breadcrumb.jsx](src/components/Breadcrumb.jsx)): Navigation breadcrumbs
- **SideBar** ([src/components/sideBar.jsx](src/components/sideBar.jsx)): Sidebar filters/navigation

### Data Flow
- **App.jsx** imports and orchestrates all layout/content components
- `dummyData` array in [App.jsx](src/App.jsx) contains sample forum posts with fields: `id`, `authorName`, `authorRole`, `location`, `timeAgo`, `avatar`, `content`, `tags`, `likes`, `comments`
- Backend integration via [src/services/api.js](src/services/api.js) (see below)

## Backend Integration

### API Service Pattern
All backend communication uses **axios** with a centralized API client in [src/services/api.js](src/services/api.js):

**Base Configuration:**
- Base URL: `http://localhost:8000`
- Content-Type: `application/json`
- JWT token auto-injected via request interceptor (reads from `localStorage.token`)

**API Methods:**
- `authAPI.login(credentials)` → POST `/login` (Section 4.1.2)
- `authAPI.register(userData)` → POST `/users/create` (Section 4.1.1)
- `questionAPI.submit(data)` → POST `/questions/` (Section 4.2.1)
- `questionAPI.getAll()` → GET `/editor/questions` (Section 4.2.2)
- `articleAPI.getPublished(params)` → GET `/articles/` (Section 4.4.1)
- `articleAPI.getSingle(id)` → GET `/articles/{id}` (Section 4.4.2)
- `articleAPI.create(data)` → POST `/editor/articles/create` (Protected)
- `articleAPI.delete(id)` → DELETE `/editor/articles/{id}` (Protected)

**When adding new API methods:** Follow the existing pattern - group by resource (e.g., `articleAPI`), comment with backend documentation section reference.

## Styling & Design System

### Tailwind CSS Configuration
- Font: **Roboto** (defined in [tailwind.config.js](tailwind.config.js))
- Custom color palette observed in components:
  - Green accent: `bg-green-600` / `hover:bg-green-700` (auth buttons)
  - Sage/muted: `bg-[#e6e7dc]`, text `text-[#1f5f4a]`, `text-[#5f6f68]`
  - Text: `text-[#1e1e1e]` (primary content)

### Component Styling Conventions
- Use `className` with inline Tailwind utilities (no CSS modules)
- Common patterns: `flex flex-col gap-4`, `inline-flex items-center justify-between`, `p-4 rounded-lg`
- Use shadow utilities (`shadow-md`, `shadow-lg`) for depth
- Hover states: `hover:opacity-70`, `hover:bg-green-700 transition-colors/opacity`
- Responsive: Use `max-w-[width]`, explicit widths via custom classes (e.g., `w-[196px]`)
- Animation: `transition-all active:scale-95` for interactions

## Development Workflow

### Running the Project
```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Production build to dist/
npm run lint       # ESLint check (configured in eslint.config.js)
npm run preview    # Preview production build locally
```

### Linting Rules
- ESLint config: [eslint.config.js](eslint.config.js)
- Recommended plugins: `react-hooks`, `react-refresh` (Vite HMR support)
- Custom rule: `no-unused-vars` ignores uppercase/underscore-prefixed variables (e.g., `_unused`, `CONSTANT`)
- React components should use `.jsx` extension

### Git Workflow
- Main branch: `main` (referenced in recent commits like `62d786b..fdb6521`)
- Push after feature completion

## Key Conventions & Patterns

1. **Component Props:** Use destructuring with sensible defaults (see [commentcard.jsx](src/components/commentcard.jsx#L3-L10))
2. **Event Handlers:** Inline JSX with `onClick`, use `transition-` classes for smooth interactions
3. **Imports:** Always use `.jsx` extension for components; comment sections reference backend docs
4. **Dummy Data:** Forum posts use consistent `dummyData` structure in [App.jsx](src/App.jsx#L14-L60)
5. **Images:** Use external CDN URLs (Anima design system) or local public assets
6. **Content Language:** German (site copy, user-facing text) with professional agricultural tone

## Common Tasks

### Adding a New Page/Component
1. Create `.jsx` file in `src/components/` or `src/pages/`
2. Import in [App.jsx](src/App.jsx) and add to layout
3. Use Tailwind classes for styling; follow existing hover/transition patterns
4. If needs data: wire via props from [App.jsx](src/App.jsx) `dummyData`

### Integrating New API Endpoint
1. Add method to appropriate group in [src/services/api.js](src/services/api.js) (e.g., `articleAPI.newMethod()`)
2. Reference backend documentation section
3. Use existing `api` client (axios instance with JWT interceptor)

### Styling Tweaks
1. Modify Tailwind utilities directly in `className`
2. For custom colors: add to `theme.extend` in [tailwind.config.js](tailwind.config.js)
3. Font is Roboto; ensure `font-['Roboto']` in text components if not inherited

## Troubleshooting

- **Port 8000 unavailable:** Backend not running; check `.env` or start backend service
- **JWT errors:** Verify token stored in `localStorage.token` during auth flow
- **HMR not working:** Ensure `@vitejs/plugin-react` and `react-refresh` are active in [vite.config.js](vite.config.js)
- **Linting errors:** Check `no-unused-vars` rule; prefix unused variables with `_`

---

**Last Updated:** January 2026 | **Backend Doc Reference:** Ilia's Documentation (Sections 4.1–4.4)
