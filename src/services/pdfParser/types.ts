import { ExtractedData } from '../../types';

export interface TextItem {
  str: string;
  transform: number[];
}

export interface TextContent {
  items: TextItem[];
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