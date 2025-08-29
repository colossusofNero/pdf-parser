# RCG Valuation PDF Processor

A React application that extracts data from PDF files and submits it to Google Sheets.

## Features

- PDF data extraction using PDF.js
- Form validation and user input
- Google Sheets integration
- File upload to Google Drive (optional)
- Responsive design with Tailwind CSS

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Google Sheets Integration (choose one method)

# Method 1: Google Apps Script Web App (Recommended)
VITE_GOOGLE_SHEETS_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec

# Method 2: Direct Google Sheets API
VITE_GOOGLE_API_KEY=your_google_api_key
VITE_GOOGLE_SPREADSHEET_ID=your_spreadsheet_id

# Optional: Google Drive integration
VITE_GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id
```

## Google Sheets Setup

### Method 1: Google Apps Script (Recommended)

1. Create a new Google Apps Script project
2. Replace the default code with a script that accepts POST requests and writes to your Google Sheet
3. Deploy as a web app with execute permissions set to "Anyone"
4. Use the web app URL as `VITE_GOOGLE_SHEETS_URL`

### Method 2: Direct API

1. Enable the Google Sheets API in Google Cloud Console
2. Create an API key
3. Share your Google Sheet with the service account or make it publicly editable
4. Use the API key and spreadsheet ID in your environment variables

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Data Fields

The application extracts and submits the following fields:

- Name_of_Prospect
- Address_of_Property
- Zip_Code
- Purchase_Price
- Capital_Improvements_Amount
- Building_Value
- Know_Land_Value
- Date_of_Purchase
- SqFt_Building
- Acres_Land
- Year_Built
- Bid_Amount_Original
- Pay_Upfront
- Pay_50_50_Amount
- Pay_Over_Time
- Rush_Fee
- Multiple_Properties_Quote
- First_Year_Bonus_Quote
- Tax_Year
- Tax_Deadline_Quote
- Contact_Name_First
- Contact_Name_Last
- Contact_Phone
- Email_from_App
- Quote_pdf
- CapEx_Date
- Type_of_Property_Quote