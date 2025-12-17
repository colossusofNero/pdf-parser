import { ExtractedData } from '../../types';
import { TextContent as PDFTextContent } from 'pdfjs-dist/types/src/display/api';

export type TextItem = {
  str: string;
  transform: number[];
};

export type TextContent = PDFTextContent;

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

export interface FieldPattern {
  regex: RegExp;
  type: string;
  required?: boolean;
}