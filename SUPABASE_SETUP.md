# Supabase setup

Task Manager now keeps its existing `localStorage` cache and synchronizes the workspace to a private Supabase row. On first connection it creates a Supabase anonymous-auth session; each browser profile gets its own workspace. The session persists in that browser, but anonymous accounts are not a cross-device sign-in method. Clearing browser storage can lose access to that anonymous account.

## 1. Configure Supabase

1. Create a Supabase project.
2. In **Authentication → Providers**, enable **Anonymous Sign-Ins**.
3. In the SQL Editor, run `supabase/migrations/20261127000000_task_workspaces.sql`.
4. Copy the project URL and its anon/publishable key from the project's API settings.

The migration creates `public.task_workspaces` and enables row-level security. Policies restrict every row to its authenticated owner. Do not disable RLS or put a `service_role` key in the browser.

## 2. Configure and run the app

Copy `.env.example` to `.env.local`, then fill in the project URL and anon/publishable key:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
```

Install dependencies and run the usual development command:

```bash
npm install
npm run dev
```

Restart the dev server after changing environment variables. For deployment, configure the same `VITE_` variables in the hosting provider's build environment and rebuild the frontend.

## Data behavior

- Existing browser data is uploaded to the newly created anonymous user's workspace if that account has no remote row yet.
- If a remote workspace already exists, it is restored into the local cache when the app starts.
- Successful local saves are synchronized to Supabase in the background. `localStorage` remains the immediate cache and fallback.
- Without Supabase environment variables, the app continues to work locally as before.
- The public anon/publishable key is not a secret. The `service_role` key is privileged and must never be exposed in frontend variables.

Anonymous accounts are separate for each browser profile and domain. To sync the same tasks across devices or between AI Studio and GitHub Pages, enable the **Email** provider in **Authentication → Providers** and sign in using the **Account** button in the top navigation bar.
