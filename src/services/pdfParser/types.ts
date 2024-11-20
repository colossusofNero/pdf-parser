// PDF parsing related interfaces (your existing interfaces)
export interface TextItem {
  str: string;
  transform: number[];
}

export interface TextContent {
  items: TextItem[];
}

// Base ExtractedData interface with all fields
export interface ExtractedData {
  firstName?: string;  // Maps to Contact_Name_First
  lastName?: string;   // Maps to Contact_Name_Last
  email?: string;      // Maps to Email_from_App
  smsPhone?: string;   // Maps to Contact_Phone
  
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
  Pay_Upfront?: boolean;
  Pay_50_50_Amount?: number;
  Pay_Over_Time?: boolean;
  Rush_Fee?: number;
  Multiple_Properties_Quote?: boolean;
  First_Year_Bonus_Quote?: number;
  Tax_Year?: number;
  Tax_Deadline_Quote?: string;
  [key: string]: any; // Allow additional dynamic properties
}

export interface MetadataField {
  key: keyof ExtractedData;
  type: 'text' | 'number' | 'currency' | 'date' | 'zipcode';
  required?: boolean;
}

export interface PDFParserOptions {
  validateFields?: boolean;
  throwOnMissingFields?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Add these new interfaces
export interface SubmissionData extends ExtractedData {
  firstName: string;  // Required for submission
  lastName: string;   // Required for submission
  email: string;      // Required for submission
  smsPhone?: string;  // Optional
}

export interface CaspioError {
  Code: string;
  Message: string;
  Resource: string;
  RequestId: string;
}