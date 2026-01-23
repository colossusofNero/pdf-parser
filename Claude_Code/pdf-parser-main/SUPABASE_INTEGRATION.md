# Supabase Integration Setup

## What Was Added

The PDF parser now submits data to **both** Google Sheets and Supabase simultaneously.

### New Files Created:
1. `api/submit-to-supabase.ts` - Supabase submission endpoint
2. `.env` - Environment variables for local development
3. Updated `src/services/api.ts` - Added `submitToSupabase()` function
4. Updated `src/App.tsx` - Submits to both destinations

## How It Works

- When a user submits the form, data is sent to **both** Google Sheets AND Supabase
- **Independent error handling**: If one fails, the other still attempts
- **Success notifications**:
  - ✅ Both succeed: "Data successfully submitted to both Google Sheets and Supabase!"
  - ⚠️ Partial success: Shows which succeeded/failed
  - ❌ Both fail: Error message displayed

## Supabase Table

Data is inserted into the `a_quote_webapp_tbl` table with these fields:
- `name_of_prospect`, `address_of_property`, `zip_code`
- `purchase_price`, `capital_improvements_amount`, `building_value`
- `know_land_value`, `date_of_purchase`, `sqft_building`
- `acres_land`, `year_built`, `bid_amount_original`
- `pay_upfront`, `pay_50_50_amount`, `pay_over_time`
- `rush_fee`, `multiple_properties_quote`, `first_year_bonus_quote`
- `tax_year`, `tax_deadline_quote`, `capex_date`
- `type_of_property_quote`, `email_from_app`
- `contact_name_first`, `contact_name_last`, `contact_phone`
- `quote_pdf`, `timestamp`

## Production Deployment (Vercel)

### Add These Environment Variables to Vercel:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add these three variables:

```
VITE_SUPABASE_URL=https://bwneehtuiqnrapsxzinu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3bmVlaHR1aXFucmFwc3h6aW51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NDQ2MzYsImV4cCI6MjA3NjIyMDYzNn0.e3dqi0o8MQB-sKbAN5UaxeoX51ZBfKToHxMuUOUP9qA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3bmVlaHR1aXFucmFwc3h6aW51Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY0NDYzNiwiZXhwIjoyMDc2MjIwNjM2fQ.TdzuNpmdMxd19N4I2kG-i64hVNHqeYaKOe70OI04fdo
```

4. **Your existing Google Sheets variables remain unchanged**
5. Redeploy your application

## Testing

### Local Testing:
```bash
npm run dev
```

### What to Test:
1. Upload a PDF file
2. Fill out the form
3. Click "Submit to Google Sheets & Supabase"
4. Check browser console for submission logs
5. Verify data appears in both:
   - Your Google Sheet
   - Supabase table `a_quote_webapp_tbl`

## Troubleshooting

### Google Sheets Not Working
- Your existing Google Sheets credentials in Vercel should still work
- No changes were made to the Google Sheets submission logic
- The `.env` file comments out Google Sheets vars to avoid conflicts

### Supabase Not Working
- Check that Supabase environment variables are set in Vercel
- Verify the table `a_quote_webapp_tbl` exists in Supabase
- Check Vercel function logs for detailed error messages

### Both Failing
- Check browser console for error messages
- Verify API endpoints are accessible: `/api/submit-to-google-sheets` and `/api/submit-to-supabase`
- Check Vercel deployment logs

## Architecture

```
User submits form
    ↓
App.tsx (handleSubmitToGoogleSheets)
    ↓
    ├── submitToGoogleSheets() → /api/submit-to-google-sheets → Google Sheets
    └── submitToSupabase() → /api/submit-to-supabase → Supabase
```

Both submissions happen in parallel with independent error handling.

