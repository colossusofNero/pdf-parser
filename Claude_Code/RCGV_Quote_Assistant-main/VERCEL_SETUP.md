# Vercel Deployment Setup

## Critical: Environment Variables

The `.env` file is gitignored and will NOT be deployed. You **must** set environment variables in the Vercel dashboard.

### Required Environment Variables

Go to your Vercel project settings and add these variables:

1. **VITE_OVERRIDE_PASS**
   - Value: `Prosecco_Time_Is_Anytime`
   - Description: Password for manual price overrides

2. **VITE_API_BASE_URL**
   - Value: `https://rcgv-quote-backend.onrender.com`
   - Description: Backend API URL

3. **VITE_SUPABASE_URL**
   - Value: `https://vtjiltcqbncidhjgispe.supabase.co`
   - Description: Supabase project URL

4. **VITE_SUPABASE_ANON_KEY**
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0amlsdGNxYm5jaWRoamdpc3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNjAzMTUsImV4cCI6MjA3NjYzNjMxNX0.jKf6rsrjRRfPxN0-Vc8okgGegbnrmyYFnDtJD6oXPlQ`
   - Description: Supabase anonymous key

5. **VITE_ELEVENLABS_AGENT_ID**
   - Value: `agent_4001kaa2sybxfqja2jhxj31ghewy`
   - Description: ElevenLabs conversational AI agent ID
   - **CRITICAL**: Widget will not load without this variable

## How to Set Environment Variables in Vercel

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dashboard
2. Select your project (rcgv-quote-assistant or similar)
3. Click "Settings" tab
4. Click "Environment Variables" in the left sidebar
5. For each variable:
   - Enter the variable name (e.g., `VITE_ELEVENLABS_AGENT_ID`)
   - Enter the value
   - Select environments: Production, Preview, Development (check all)
   - Click "Save"
6. After adding all variables, redeploy the project

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Link to your project
vercel link

# Add environment variables
vercel env add VITE_ELEVENLABS_AGENT_ID production
# Paste the value when prompted: agent_4001kaa2sybxfqja2jhxj31ghewy

# Repeat for each variable
```

## Force Redeploy After Adding Environment Variables

After adding/updating environment variables:

### Option 1: Via Dashboard
1. Go to Deployments tab
2. Find latest deployment
3. Click the three dots menu
4. Click "Redeploy"
5. Check "Use existing Build Cache" should be UNCHECKED to force fresh build

### Option 2: Via Empty Commit
```bash
git commit --allow-empty -m "chore: Force Vercel redeploy with updated env vars"
git push
```

### Option 3: Via Vercel CLI
```bash
vercel --prod --force
```

## Verify Deployment

After deployment completes:

1. Open your production URL in a **new incognito/private window** (to avoid browser cache)
2. Open browser DevTools (F12)
3. Check Console tab for: `🔍 ElevenLabs Widget Debug: { hasAgentId: true }`
4. Look for the green ElevenLabs widget button in bottom-right corner
5. Verify the page shows correct UI layout:
   - "Use Example Data" button at top
   - Form fields in middle
   - "Compute Quote" button below fields
   - "Submit & Request" button below quote results

## Troubleshooting

### Widget Not Showing
- Check browser console for: `⚠️ ElevenLabs widget not loading: agentId is missing`
- If you see this, the environment variable is not set correctly in Vercel
- Verify variable name is exactly `VITE_ELEVENLABS_AGENT_ID` (case-sensitive)
- Redeploy after fixing

### Old Version Showing Despite New Deployment
1. **Browser Cache**: Open in incognito/private window
2. **Vercel CDN Cache**: Wait 5-10 minutes, or use `?v=timestamp` in URL
3. **Build Cache**: Redeploy with "Use existing Build Cache" unchecked
4. **Wrong Environment**: Verify you're looking at production URL, not preview

### Build Succeeds But Changes Not Visible
- Check the commit hash in deployment details matches your latest Git commit
- Verify the correct branch is deployed (usually `main`)
- Check deployment logs for any warnings
- Ensure all environment variables are set for "Production" environment

## Project Structure

```
rcgv-quote-ui/
├── .env                    # Local development only (gitignored)
├── .env.example           # Template for required variables
├── vercel.json            # Vercel configuration (rewrites for API)
└── src/
    ├── components/
    │   ├── QuoteFormWithAI.jsx      # Main form component
    │   └── ElevenLabsWidget.jsx     # Voice AI widget
    └── ...
```

## Build Configuration in Vercel

Your `vercel.json` should have:
```json
{
  "rewrites": [
    { "source": "/quote/:path*", "destination": "/api/quote/:path*" },
    { "source": "/agent/:path*", "destination": "/api/agent/:path*" }
  ]
}
```

Build settings should be:
- **Framework Preset**: Vite
- **Root Directory**: `rcgv-quote-ui`
- **Build Command**: `npm run build` (or `vite build`)
- **Output Directory**: `dist`
- **Install Command**: `npm install`

## Common Issues

### Issue: "Module not found" errors in build
**Solution**: Check that `package.json` dependencies match local development

### Issue: Environment variables work locally but not in production
**Solution**: Remember that `.env` is gitignored. Set all variables in Vercel dashboard.

### Issue: Widget shows but doesn't respond
**Solution**: Check that backend webhooks are configured correctly in ElevenLabs dashboard

---

**Last Updated**: November 18, 2025
**Version**: Matches commit 17bc30f
