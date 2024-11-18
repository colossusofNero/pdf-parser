import { FieldPattern } from './types';

export const fieldPatterns: Record<string, FieldPattern> = {
  companyName: {
    regex: /Company:\s*([^:\n]+)/,
    type: 'text',
    required: true
  },
  propertyType: {
    regex: /Property Type:\s*([^:\n]+)/,
    type: 'text'
  },
  address: {
    regex: /Address:\s*([^:\n]+)/,
    type: 'text',
    required: true
  },
  purchasePrice: {
    regex: /Purchase Price:\s*([\d,]+(?:\.\d{2})?)/,
    type: 'number',
    required: true
  },
  landValue: {
    regex: /Land Value:\s*([\d,]+(?:\.\d{2})?)/,
    type: 'number'
  },
  purchaseDate: {
    regex: /Purchase Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/,
    type: 'date'
  },
  buildingSqFt: {
    regex: /Building SqFt:\s*([\d,]+)/,
    type: 'number'
  },
  acresLand: {
    regex: /Acres Land:\s*([\d,.]+)/,
    type: 'number'
  },
  dueDate: {
    regex: /Due Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/,
    type: 'date'
  },
  bidAmount: {
    regex: /Bid Amount:\s*([\d,]+(?:\.\d{2})?)/,
    type: 'number'
  },
  rushFee: {
    regex: /Rush Fee:\s*([\d,]+(?:\.\d{2})?)/,
    type: 'number'
  }
};