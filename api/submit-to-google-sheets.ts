import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { PartialExtractedData } from '../services/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body as PartialExtractedData;
    
    // Basic validation
    if (!data.Name_of_Prospect || !data.Address_of_Property) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get Google Sheets credentials from environment variables
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!serviceAccountEmail || !privateKey || !spreadsheetId) {
      return res.status(500).json({ 
        error: 'Missing Google Sheets configuration. Please check environment variables.' 
      });
    }

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey,
        project_id: process.env.GOOGLE_PROJECT_ID || 'pdf-parser-project'
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare the row data in the order of your spreadsheet columns
    const rowData = [
      data.Name_of_Prospect || '',
      data.Address_of_Property || '',
      data.Zip_Code || '',
      data.Purchase_Price || 0,
      data.Capital_Improvements_Amount || 0,
      data.Building_Value || 0,
      data.Know_Land_Value || 0,
      data.Date_of_Purchase || '',
      data.SqFt_Building || 0,
      data.Acres_Land || 0,
      data.Year_Built || 0,
      data.Bid_Amount_Original || 0,
      data.Pay_Upfront || 0,
      data.Pay_50_50_Amount || 0,
      data.Pay_Over_Time || 0,
      data.Rush_Fee || 0,
      data.Multiple_Properties_Quote || 0,
      data.First_Year_Bonus_Quote || 0,
      data.Tax_Year || 0,
      data.Tax_Deadline_Quote || '',
      data.CapEx_Date || '',
      data.Type_of_Property_Quote || '',
      data.Email_from_App || '',
      data.Contact_Name_First || '',
      data.Contact_Name_Last || '',
      data.Contact_Phone || '',
      new Date().toISOString() // Timestamp
    ];

    // Append data to the spreadsheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:AA', // Adjust range based on your sheet structure
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData]
      }
    });

    console.log('Google Sheets submission successful:', response.data);
    return res.status(200).json({ 
      success: true, 
      data: { 
        updatedRange: response.data.updates?.updatedRange,
        updatedRows: response.data.updates?.updatedRows
      } 
    });

  } catch (error) {
    console.error('Error submitting to Google Sheets:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Unable to parse range')) {
        return res.status(400).json({
          error: 'Invalid spreadsheet range',
          details: 'Please check your spreadsheet ID and range configuration'
        });
      } else if (error.message.includes('The caller does not have permission')) {
        return res.status(403).json({
          error: 'Permission denied',
          details: 'Service account does not have access to the spreadsheet'
        });
      } else if (error.message.includes('Requested entity was not found')) {
        return res.status(404).json({
          error: 'Spreadsheet not found',
          details: 'Please check your spreadsheet ID'
        });
      }
    }

    return res.status(500).json({
      error: 'Error submitting to Google Sheets',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
