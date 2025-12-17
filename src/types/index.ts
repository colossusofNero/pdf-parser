export interface ExtractedData {
  Name_of_Prospect: string;
  Address_of_Property: string;
  Zip_Code: string;
  Purchase_Price: number;
  Capital_Improvements_Amount: number;
  Building_Value: number;
  Know_Land_Value: number;
  Date_of_Purchase: string; // Ensure format is MM/DD/YYYY
  SqFt_Building: number;
  Acres_Land: number;
  Year_Built: number;
  Bid_Amount_Original: number;
  Pay_Upfront: number;
  Pay_50_50_Amount: number;
  Pay_Over_Time: number;
  Rush_Fee: number;
  Multiple_Properties_Quote: number;
  First_Year_Bonus_Quote: number;
  Tax_Year: number;
  Tax_Deadline_Quote: string;
  CapEx_Date: string;
  Type_of_Property_Quote: string;

  // Required fields for user contact information
  Email_from_App: string; // Mandatory
  firstName: string; // Mandatory
  lastName: string; // Mandatory
  smsPhone?: string; // Optional
  file?: File; // Optional
  
  // Add depreciation table reference
  depreciationTable?: DepreciationRow[];
}

export interface DepreciationRow {
  year: number;
  standardDepreciation: number;
  traditionalCostSeg: number;
  bonusDepreciation: number;
  firstYearBonusQuote?: number; // Optional field for PropertyInfoForm
  taxYear?: number; // Optional field for PropertyInfoForm
  totalBidAmount?: number; // Optional field for PropertyInfoForm
}