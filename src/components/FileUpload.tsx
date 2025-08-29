import React, { useState } from 'react';

interface UserData {
  firstName: string;
  lastName: string;
  Email_from_App: string;
  smsPhone?: string;
}

interface FileUploadProps {
  onFileSelect: (file: File, userData: UserData) => Promise<void> | void;
  isLoading?: boolean;
}

function FileUpload({ onFileSelect, isLoading }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailFromApp, setEmailFromApp] = useState('');
  const [smsPhone, setSmsPhone] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (typeof onFileSelect !== 'function') {
      console.error('FileUpload: onFileSelect prop is missing or not a function', { onFileSelect });
      throw new Error('Internal configuration error: onFileSelect not provided');
    }
    await onFileSelect(file, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      Email_from_App: emailFromApp.trim(),
      smsPhone: smsPhone.trim()
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">PDF file</label>
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block w-full" disabled={!!isLoading} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First name</label>
          <input className="mt-1 w-full border border-gray-300 rounded p-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!!isLoading} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last name</label>
          <input className="mt-1 w-full border border-gray-300 rounded p-2" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!!isLoading} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" className="mt-1 w-full border border-gray-300 rounded p-2" value={emailFromApp} onChange={(e) => setEmailFromApp(e.target.value)} disabled={!!isLoading} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">SMS phone (optional)</label>
          <input className="mt-1 w-full border border-gray-300 rounded p-2" value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} disabled={!!isLoading} />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={!file || !!isLoading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {isLoading ? 'Processing...' : 'Upload & Extract'}
        </button>
      </div>
    </form>
  );
}

export default FileUpload;
