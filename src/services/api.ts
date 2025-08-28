// services/api.ts - Minimal version (or delete this file entirely)
// This file is no longer needed since App.tsx is self-contained
// But keeping minimal exports in case other files reference them

export interface ExtractedData {
  Name_of_Prospect?: string;
  Address_of_Property?: string;
  Zip_Code?: string;
  Purchase_Price?: number;
  Capital_Improvements_Amount?: number;
  Building_Value?: number;
  Know_Land_Value?: number;
  Date_of_Purchase?: string;
  SqFt_Building?: number;
  Acres_Land?: number;
  Year_Built?: number;
  Bid_Amount_Original?: number;
  Pay_Upfront?: number;
  Pay_50_50_Amount?: number;
  Pay_Over_Time?: number;
  Rush_Fee?: number;
  Multiple_Properties_Quote?: number;
  First_Year_Bonus_Quote?: number;
  Tax_Year?: number;
  Tax_Deadline_Quote?: string;
  Contact_Name_First?: string;
  Contact_Name_Last?: string;
  Contact_Phone?: string;
  Email_from_App?: string;
  Quote_pdf?: string;
  CapEx_Date?: string;
  Type_of_Property_Quote?: string;
  file?: File;
}

export type PartialExtractedData = Partial<ExtractedData>;

// Legacy functions - no longer used
export const extractPdfData = async (file: File): Promise<PartialExtractedData> => {
  throw new Error('Use client-side extraction in App.tsx instead');
};

export const uploadFileToCaspio = async (file: File): Promise<string> => {
  throw new Error('File upload handled in App.tsx');
};

export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  throw new Error('Submission handled in App.tsx');
};
