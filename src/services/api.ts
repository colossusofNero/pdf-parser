const submitToCaspio = async (data: ExtractedData) => {
  try {
    const apiUrl = import.meta.env.VITE_CASPIO_API_URL;
    const apiKey = import.meta.env.VITE_CASPIO_API_KEY;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Name_of_Prospect: data.Name_of_Prospect,
        Address_of_Property: data.Address_of_Property,
        Zip_Code: data.Zip_Code,
        Purchase_Price: data.Purchase_Price,
        Capital_Improvements_Amount: data.Capital_Improvements_Amount,
        Building_Value: data.Building_Value,
        Know_Land_Value: data.Know_Land_Value,
        Date_of_Purchase: data.Date_of_Purchase,
        SqFt_Building: data.SqFt_Building,
        Acres_Land: data.Acres_Land,
        Year_Built: data.Year_Built,
        Bid_Amount_Original: data.Bid_Amount_Original,
        Pay_Upfront: data.Pay_Upfront,
        Pay_50_50_Amount: data.Pay_50_50_Amount,
        Pay_Over_Time: data.Pay_Over_Time,
        Rush_Fee: data.Rush_Fee,
        Multiple_Properties_Quote: data.Multiple_Properties_Quote,
        First_Year_Bonus_Quote: data.First_Year_Bonus_Quote,
        Tax_Year: data.Tax_Year,
        Tax_Deadline_Quote: data.Tax_Deadline_Quote
      })
    });

    if (!response.ok) {
      throw new Error(`Caspio API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Caspio submission error:', error);
    throw error;
  }
};