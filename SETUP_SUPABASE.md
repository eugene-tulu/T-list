# Supabase Setup Guide

This guide walks through setting up Supabase for the Tender Finder MVP.

## Prerequisites

- Supabase account (sign up at https://supabase.com)
- Supabase CLI installed (optional, for migrations)

## 1. Create Supabase Project

1. Go to https://app.supabase.com/
2. Click "New Project"
3. Choose your organization and enter:
   - Project name: `tender-finder` (or your preferred name)
   - Database password: (save this securely)
   - Region: Choose closest to you
4. Wait for project to be created

## 2. Get Your Credentials

In your Supabase project dashboard:

1. Go to **Settings** → **API**
2. Copy the **URL** (e.g., `https://xyz.supabase.co`)
3. Copy the **anon/public key** (starts with `eyJ...`)
4. Also note your **service_role key** (keep this secret, used for edge functions)

## 3. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

**Important:** The `VITE_` prefix is required for Vite to expose these to the client.

## 4. Apply Database Migration

### Option A: Using Supabase Studio (Easiest)

1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `supabase/migrations/001_create_supplier_profiles.sql`
5. Paste into the editor
6. Click **Run** (or Ctrl+Enter)

### Option B: Using Supabase CLI

```bash
# Link your project (if not already)
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

## 5. Enable Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable at least one provider (e.g., **Email** with "Confirm email" OFF for easier testing)
3. Optionally configure **Site URL** under **Authentication** → **URL Configuration**

## 6. Deploy Edge Functions

The TinyFish search function needs to be deployed to Supabase Edge Functions.

1. Install Supabase CLI if not already: `npm install -g supabase`
2. Login: `supabase login`
3. Link your project: `supabase link --project-ref your-project-ref`
4. Set the TinyFish API key secret:

```bash
supabase secrets set TINYFISH_API_KEY=your_tinyfish_api_key_here
```

5. Deploy the function:

```bash
supabase functions deploy tinyfish-tender-search
```

**Note:** The `discover-tender-links` function is static and doesn't need deployment.

## 7. Test the Application

1. Start the dev server:

```bash
npm run dev
```

2. Open http://localhost:5173 (or the port shown in terminal)

3. Test flow:
   - Fill out the supplier profile form (company name, country, sector, size, etc.)
   - Click "Continue to Portal Selection"
   - Click "Start Search"
   - Verify:
     - Agents appear and update status
     - Tenders load with fit scores (percentage badges)
     - Cards show match reasons and gaps
     - Results are sorted by score (highest first)

4. Check Supabase:
   - Go to **Table Editor** → `supplier_profiles`
   - Verify your profile was saved after form submission

## Troubleshooting

### "Failed to load profile" or auth errors
- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are correct in `.env`
- Check browser console for specific errors
- Verify Supabase project is active (not paused)

### Edge function errors
- Verify `TINYFISH_API_KEY` is set in Supabase secrets: `supabase secrets list`
- Redeploy function: `supabase functions deploy tinyfish-tender-search`
- Check function logs in Supabase dashboard → **Edge Functions** → `tinyfish-tender-search` → **Logs**

### No tenders found
- Ensure TinyFish API key is valid and has credits
- Try different sectors (e.g., "IT Services", "Construction")
- Check that the edge function is returning data (logs)

### TypeScript errors about `any`
- These are suppressed in edge functions (Deno-specific code)
- Build should still succeed (`npm run build`)

## Next Steps After Setup

Once Supabase is configured:
1. Users can create accounts (or use anonymous auth for MVP testing)
2. Supplier profiles are persisted per user
3. Fit scoring works with enriched tender data
4. Ready to add draft generation (LLM integration) in Phase 2

## Files Modified/Added

- `src/integrations/supabase/types.ts` - Added `supplier_profiles` table type
- `src/hooks/useSupplierProfile.ts` - New hook for profile CRUD
- `src/components/tender/SupplierProfileForm.tsx` - Extended with new fields
- `src/hooks/useTenderSearch.ts` - Enhanced scoring & gap analysis
- `src/components/tender/TenderResultCard.tsx` - Display fit scores & reasons
- `supabase/migrations/001_create_supplier_profiles.sql` - Database schema
