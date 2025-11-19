# Fresh Vercel Deployment Setup

## Step 1: Delete Old Vercel Project

1. Go to https://vercel.com/dashboard
2. Find your old project (rcgv-quote-assistant or similar)
3. Click on the project
4. Go to **Settings** (top navigation)
5. Scroll to bottom → **Delete Project**
6. Type the project name to confirm
7. Click "Delete"

## Step 2: Create New Vercel Project

### Option A: Via Vercel Dashboard (Recommended for First Time)

1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Select **Import Git Repository**
4. Choose your GitHub repository: `colossusofNero/RCGV_Quote_Assistant`
5. Click **"Import"**

### Configure Project Settings

**CRITICAL SETTINGS - Set these before deploying:**

#### Framework Preset
- Select: **Vite**

#### Root Directory
- Click **"Edit"** next to Root Directory
- Set to: `rcgv-quote-ui`
- Click **"Continue"**

#### Build Settings
- Build Command: `npm run build` (should auto-fill)
- Output Directory: `dist` (should auto-fill)
- Install Command: `npm install` (should auto-fill)

#### Environment Variables
**Add ALL of these BEFORE first deployment:**

Click **"Environment Variables"** section, then add each one:

1. **VITE_OVERRIDE_PASS**
   - Value: `Prosecco_Time_Is_Anytime`
   - Environments: Production, Preview, Development (check all 3)

2. **VITE_API_BASE_URL**
   - Value: `https://rcgv-quote-backend.onrender.com`
   - Environments: Production, Preview, Development (check all 3)

3. **VITE_SUPABASE_URL**
   - Value: `https://vtjiltcqbncidhjgispe.supabase.co`
   - Environments: Production, Preview, Development (check all 3)

4. **VITE_SUPABASE_ANON_KEY**
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0amlsdGNxYm5jaWRoamdpc3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNjAzMTUsImV4cCI6MjA3NjYzNjMxNX0.jKf6rsrjRRfPxN0-Vc8okgGegbnrmyYFnDtJD6oXPlQ`
   - Environments: Production, Preview, Development (check all 3)

5. **VITE_ELEVENLABS_AGENT_ID** ⚠️ CRITICAL
   - Value: `agent_4001kaa2sybxfqja2jhxj31ghewy`
   - Environments: Production, Preview, Development (check all 3)

#### Deploy
- Click **"Deploy"**
- Wait for build to complete (2-3 minutes)

### Option B: Via Vercel CLI (Alternative Method)

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to project directory
cd C:\Users\scott\Claude_Code\RCGV_Quote_Assistant-main

# Remove old vercel configuration
rm -rf .vercel

# Login to Vercel
vercel login

# Deploy with configuration
vercel

# When prompted:
# - Set up and deploy? Y
# - Which scope? Select your account
# - Link to existing project? N
# - What's your project's name? rcgv-quote-assistant-new
# - In which directory is your code located? rcgv-quote-ui
# - Want to override the settings? Y
# - Build Command: npm run build
# - Output Directory: dist
# - Development Command: npm run dev

# Add environment variables
vercel env add VITE_OVERRIDE_PASS production
# Paste: Prosecco_Time_Is_Anytime

vercel env add VITE_API_BASE_URL production
# Paste: https://rcgv-quote-backend.onrender.com

vercel env add VITE_SUPABASE_URL production
# Paste: https://vtjiltcqbncidhjgispe.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0amlsdGNxYm5jaWRoamdpc3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNjAzMTUsImV4cCI6MjA3NjYzNjMxNX0.jKf6rsrjRRfPxN0-Vc8okgGegbnrmyYFnDtJD6oXPlQ

vercel env add VITE_ELEVENLABS_AGENT_ID production
# Paste: agent_4001kaa2sybxfqja2jhxj31ghewy

# Deploy to production
vercel --prod
```

## Step 3: Verify Deployment

1. **Get your production URL** from the deployment success message or dashboard
2. **Open in incognito/private window** (CRITICAL - avoids cache)
3. **Open DevTools** (F12)
4. **Check Console** for:
   ```
   🔧 DEBUG: API Base URL = https://rcgv-quote-backend.onrender.com
   🔍 ElevenLabs Widget Debug: { agentId: "agent_4001kaa2sybxfqja2jhxj31ghewy", hasAgentId: true }
   ✅ Loading ElevenLabs widget with agent ID: agent_4001kaa2sybxfqja2jhxj31ghewy
   ```

5. **Verify UI Elements:**
   - ✅ "Use Example Data" button at top
   - ✅ Form fields in middle
   - ✅ "Compute Quote" button centered below form
   - ✅ Green ElevenLabs widget button in bottom-right corner
   - ✅ Widget expands when clicked

6. **Test Functionality:**
   - Click "Use Example Data" - form should populate
   - Click "Compute Quote" - should see quote results
   - Click ElevenLabs widget - should open conversation interface
   - Check form fields update when agent collects information

## Step 4: Update Custom Domain (if you have one)

If you had a custom domain on the old project:

1. Go to your new project settings
2. Click **"Domains"** in left sidebar
3. Add your custom domain
4. Update DNS records as instructed by Vercel
5. Wait for DNS propagation (can take up to 48 hours, usually 5-10 minutes)

## Troubleshooting

### Build Fails with "Cannot find module"
**Cause**: Root directory not set correctly
**Solution**:
1. Go to Project Settings → General
2. Set Root Directory to `rcgv-quote-ui`
3. Redeploy

### Widget Not Showing
**Cause**: Missing VITE_ELEVENLABS_AGENT_ID
**Solution**:
1. Go to Project Settings → Environment Variables
2. Verify `VITE_ELEVENLABS_AGENT_ID` exists and has correct value
3. Redeploy

### Old Version Still Showing
**Cause**: Browser cache
**Solution**:
1. Open in incognito/private window
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Clear browser cache for the domain

### Environment Variables Not Working
**Cause**: Variables not set for all environments
**Solution**:
1. Check each variable has Production, Preview, AND Development checked
2. Redeploy after making changes

## Expected Build Output

A successful build should show:

```
[1/4] Installing dependencies...
[2/4] Building application...
vite v7.1.7 building for production...
✓ built in X seconds
[3/4] Uploading build output...
[4/4] Finalizing deployment...
✓ Deployment ready
```

## Project Structure Verification

Your Vercel project should be configured to deploy from:

```
RCGV_Quote_Assistant-main/
├── rcgv-quote-ui/              ← Root Directory in Vercel
│   ├── src/
│   │   ├── components/
│   │   │   ├── QuoteFormWithAI.jsx
│   │   │   └── ElevenLabsWidget.jsx
│   │   ├── main.jsx
│   │   └── ...
│   ├── package.json
│   ├── vite.config.js
│   ├── vercel.json
│   └── .env.example
├── service/                     ← Backend (not deployed to Vercel)
└── VERCEL_FRESH_SETUP.md
```

## What Should Match Localhost

After successful deployment, your production site should be **identical** to localhost:

### UI Layout
- ✅ Same button positions (top, center, below quote)
- ✅ Same styling and colors
- ✅ Same form fields and labels

### Functionality
- ✅ Example data populates correctly
- ✅ Quote computation returns same results
- ✅ ElevenLabs widget appears and functions
- ✅ Form validation works identically
- ✅ PDF generation works

### Expected Differences
- ❌ API responses might be slower (network latency)
- ❌ Console logs might have different timestamps
- ✅ Everything else should be IDENTICAL

## Common Mistakes to Avoid

1. ❌ **Forgetting to set Root Directory** → Build fails
2. ❌ **Not setting all environment variables before first deploy** → Widget missing
3. ❌ **Only setting variables for "Production"** → Preview/Development broken
4. ❌ **Using wrong directory name** (e.g., "rcgv-quote-ui/" with slash) → Build fails
5. ❌ **Testing in same browser tab** → Sees cached old version

## Success Checklist

Before closing, verify:

- [ ] Root Directory set to `rcgv-quote-ui`
- [ ] All 5 environment variables added
- [ ] All variables checked for Production, Preview, Development
- [ ] Build completed successfully (green checkmark)
- [ ] Opened in incognito window
- [ ] Console shows correct agent ID
- [ ] Widget visible in bottom-right
- [ ] All buttons in correct positions
- [ ] Quote computation works
- [ ] ElevenLabs conversation works

---

**Created**: November 18, 2025
**Latest Commit**: 68052e2b
