import React, { useState } from "react";

interface FileUploadProps {
  onFileSelect: (
    file: File,
    userData: {
      firstName: string;
      lastName: string;
      Email_from_App: string;
      smsPhone?: string;
    }
  ) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }) => {
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [userData, setUserData] = useState({
    firstName: "",
    lastName: "",
    Email_from_App: "",
    smsPhone: ""
  });

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validateFormData = (): boolean => {
    if (!userData.firstName.trim()) {
      setError("First Name is required");
      return false;
    }
    if (!userData.lastName.trim()) {
      setError("Last Name is required");
      return false;
    }
    if (!userData.Email_from_App.trim()) {
      setError("Email is required");
      return false;
    }
    if (!validateEmail(userData.Email_from_App)) {
      setError("Please enter a valid email address");
      return false;
    }
    if (!selectedFile) {
      setError("Please select a PDF file");
      return false;
    }
    return true;
  };

  const handleUserDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (file) {
      if (file.type !== "application/pdf") {
        setError("Please select a PDF file.");
        return;
      }
      // Simply store the original file
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateFormData()) {
      return;
    }

    try {
      if (selectedFile) {
        await onFileSelect(selectedFile, {
          ...userData,
          Email_from_App: userData.Email_from_App.trim().toLowerCase()
        });
        
        // Reset form after successful submission
        setSelectedFile(null);
        setUserData({
          firstName: "",
          lastName: "",
          Email_from_App: "",
          smsPhone: ""
        });
        
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      }
    } catch (error) {
      console.error('Submission error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during submission');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <input
              type="text"
              name="firstName"
              placeholder="First Name *"
              value={userData.firstName}
              onChange={handleUserDataChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
            <input
              type="text"
              name="lastName"
              placeholder="Last Name *"
              value={userData.lastName}
              onChange={handleUserDataChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
            <input
              type="email"
              name="Email_from_App"
              placeholder="Email *"
              value={userData.Email_from_App}
              onChange={handleUserDataChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
            <input
              type="tel"
              name="smsPhone"
              placeholder="Phone (optional)"
              value={userData.smsPhone}
              onChange={handleUserDataChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Upload PDF *</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required
              disabled={isLoading}
            />
            {selectedFile && (
              <p className="text-sm text-gray-600">Selected: {selectedFile.name}</p>
            )}
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm mt-2">{error}</div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              Processing...
            </span>
          ) : (
            'Submit'
          )}
        </button>

        <p className="text-sm text-gray-500 text-center">* Required fields</p>
      </form>
    </div>
  );
};