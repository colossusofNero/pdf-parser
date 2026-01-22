import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
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

    // Get Supabase credentials from environment variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: 'Missing Supabase configuration. Please check environment variables.'
      });
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Map the data to the Supabase table schema (a_quote_webapp_tbl)
    const supabaseData = {
      name_of_prospect: data.Name_of_Prospect || '',
      address_of_property: data.Address_of_Property || '',
      zip_code: data.Zip_Code ? parseInt(String(data.Zip_Code)) : null,
      purchase_price: data.Purchase_Price || 0,
      capital_improvements_amount: data.Capital_Improvements_Amount || 0,
      building_value: data.Building_Value || 0,
      know_land_value: data.Know_Land_Value || 0,
      date_of_purchase: data.Date_of_Purchase || '',
      sqft_building: data.SqFt_Building || 0,
      acres_land: data.Acres_Land || 0,
      year_built: data.Year_Built || 0,
      bid_amount_original: data.Bid_Amount_Original || 0,
      pay_upfront: data.Pay_Upfront || 0,
      pay_50_50_amount: data.Pay_50_50_Amount || 0,
      pay_over_time: data.Pay_Over_Time || 0,
      rush_fee: data.Rush_Fee || 0,
      multiple_properties_quote: data.Multiple_Properties_Quote?.toString() || '',
      first_year_bonus_quote: data.First_Year_Bonus_Quote || 0,
      tax_year: data.Tax_Year || 0,
      tax_deadline_quote: data.Tax_Deadline_Quote || '',
      capex_date: data.CapEx_Date || '',
      type_of_property_quote: data.Type_of_Property_Quote || '',
      email_from_app: data.Email_from_App || '',
      contact_name_first: data.Contact_Name_First || '',
      contact_name_last: data.Contact_Name_Last || '',
      contact_phone: data.Contact_Phone || '',
      quote_pdf: data.Quote_pdf || '',
      timestamp: new Date().toISOString()
    };

    // Insert data into Supabase
    const { data: insertedData, error } = await supabase
      .from('a_quote_webapp_tbl')
      .insert([supabaseData])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        error: 'Error submitting to Supabase',
        details: error.message
      });
    }

    console.log('Supabase submission successful:', insertedData);
    return res.status(200).json({
      success: true,
      data: insertedData
    });

  } catch (error) {
    console.error('Error submitting to Supabase:', error);

    return res.status(500).json({
      error: 'Error submitting to Supabase',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
