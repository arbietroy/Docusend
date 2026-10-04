# DocuSend

A multi-company platform for real estate businesses. Each company gets its own branded workspace
to manage properties, clients, payments, instalments and arrears. Clients submit their details and
proof of payment through the company's own online forms.

## Going live: one-time Supabase setup

1. **Create the database.** Open Supabase → **SQL Editor** → **New query**, paste the whole of
   [`supabase/setup.sql`](supabase/setup.sql), and click **Run**. Run it once, on an empty project.
2. **Allow the app's addresses.** In Authentication → URL Configuration, set the Site URL to
   `https://docusendwebapp.vercel.app` and add these Redirect URLs:
   `https://docusendwebapp.vercel.app/**` and `http://localhost:5173/**`.
3. **Account deletion (optional):** `supabase functions deploy delete-account`.

Later database changes are added as new files in `supabase/migrations/`. Run only the new ones.
Already applied: `20261004000001`–`20261004000003`. Run next: `20261005000001_documents.sql`.

## Routes

| Route | Who | What |
|---|---|---|
| `/` | Public | Landing page |
| `/auth` | Public | Sign up, log in, password reset. `?invite=email` is the team invite link |
| `/f/:company` | Clients | Subscription form (new purchase with proof of payment) |
| `/f/:company/pay` | Clients | Instalment form (client number + email/phone) |
| `/onboarding` | Signed in | Create a company or accept an invitation |
| `/app/...` | Team | The company workspace |

## Roles

| | Team Member | Team Lead | Admin | Super Admin |
|---|---|---|---|---|
| Clients, payments, owing & defaulting, emails | ✅ | ✅ | ✅ | ✅ |
| Confirm/reject payments, discounts, edit purchases | | ✅ | ✅ | ✅ |
| Properties, weekly summary, activity log, exports, team, company settings | | | ✅ | ✅ |
| Billing, super admin access | | | | ✅ |

The database enforces these rules with row level security, so they hold even outside the app.

## Key rules

- **Client numbers:** `COMPANY-PROPERTY-SEQ`, e.g. `HCH-PG-022`. The sequence counts clients across the
  whole company and is assigned when a client's first payment is confirmed.
- **Receipts:** `COMPANY-RCT-00001`, numbered in order when a payment is confirmed.
- **Instalments:** the deposit is due on the purchase date, and the rest is split evenly into monthly
  payments. A client is *owing* when behind schedule, and *defaulting* once they're more than the
  company's grace period (default 30 days) late.
- **Prices are locked** on each purchase, so changing a property's prices only affects new sales.
- **Documents:** admins upload Word (.docx) templates with `{{placeholders}}` (see the in-app guide),
  for the whole company or one property. The team generates documents for a purchase; they're
  filled in the browser (docxtemplater), saved to the client's file, and can be previewed,
  downloaded or printed to PDF. Sample templates live in `public/sample-templates`
  (rebuild with `node scripts/make-sample-templates.mjs`).

## Development

```bash
npm install
npm run dev            # uses the production Supabase project
```

To develop against a local Supabase instead (needs Docker):

```bash
npx supabase start                      # applies supabase/migrations
cp .env.local.example .env.local        # fill in the anon key from `npx supabase status`
npm run dev
SB_ANON=<anon key> node scripts/test-backend.mjs   # checks permissions, numbering and arrears
```

After adding a migration, run `scripts/bundle-sql.sh` to refresh `supabase/setup.sql`.

## Structure

```
src/
├── App.jsx                 routes
├── hooks/                  useAuth (login), useOrg (current company + role), useAsync
├── lib/                    api.js (all database calls), format, roles, emails, trial
├── components/layout/      AppLayout, Sidebar, TrialBanner
├── components/ui/          Button, Input, Badge/Modal, Data (cards, tables, stats)
└── pages/
    ├── app/                Overview, Payments, Clients, ClientDetail, NewClient, Collections,
    │                       Forms, Properties, Directors, Activity, Team, Settings, Billing
    ├── public/             client-facing forms
    └── OnboardingPage, AuthPage, LandingPage
supabase/
├── migrations/             database schema, security rules and functions
├── setup.sql               all migrations in one file for the SQL editor
└── functions/              delete-account edge function
```
