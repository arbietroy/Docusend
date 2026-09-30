# DocuSend — React App

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run locally:
```bash
npm run dev
```
Open http://localhost:5173

3. Build for production:
```bash
npm run build
```
Then deploy the `dist/` folder to Vercel.

## Supabase
Already configured with your project credentials in `src/lib/supabase.js`.

## Routes
- `/`          → Landing Page
- `/auth`      → Sign Up / Login / Onboarding
- `/dashboard` → Dashboard (protected — requires login)

## Project Structure
```
src/
├── App.jsx                        # Router + protected routes
├── main.jsx                       # Entry point
├── styles/global.css              # Tailwind + CSS variables
├── lib/
│   ├── supabase.js                # Supabase client
│   └── trial.js                   # Trial management
├── hooks/
│   └── useAuth.js                 # Auth context + hook
├── pages/
│   ├── LandingPage.jsx
│   ├── AuthPage.jsx
│   └── DashboardPage.jsx
└── components/
    ├── layout/
    │   ├── Sidebar.jsx
    │   └── TrialBanner.jsx
    └── ui/
        ├── Button.jsx
        ├── Input.jsx
        └── Badge.jsx
```
