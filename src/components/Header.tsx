import React from 'react';
import { FileText, Server } from 'lucide-react';

export const Header: React.FC = () => (
  <header className="mb-8">
    <h1 className="text-3xl font-bold text-gray-900 flex items-center">
      <FileText className="w-8 h-8 mr-3 text-blue-600" />
      Property Data Processor
    </h1>
    <p className="mt-2 text-gray-600 flex items-center">
      <Server className="w-4 h-4 mr-2" />
      Upload PDFs and process property data directly to Caspio
    </p>
  </header>
);