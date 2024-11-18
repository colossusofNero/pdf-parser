import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles[0].errors.map((err: any) => err.message);
      toast.error(`Invalid file: ${errors.join(', ')}`);
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File size exceeds 10MB limit');
        return;
      }
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  return (
    <div
      {...getRootProps()}
      className={`p-10 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
        isDragReject ? 'border-red-500 bg-red-50' :
        isDragActive ? 'border-blue-500 bg-blue-50' :
        'border-gray-300 hover:border-blue-400'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center text-gray-600">
        {isDragReject ? (
          <>
            <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
            <p className="text-lg font-medium text-red-600">Invalid file type</p>
          </>
        ) : isDragActive ? (
          <>
            <Upload className="w-12 h-12 mb-4 text-blue-500" />
            <p className="text-lg font-medium text-blue-600">Drop the PDF here</p>
          </>
        ) : (
          <>
            <Upload className="w-12 h-12 mb-4 text-blue-500" />
            <p className="text-lg font-medium mb-2">Drag & drop a PDF file here</p>
            <p className="text-sm text-gray-500">or click to select a file</p>
          </>
        )}
        <div className="mt-4 flex items-center text-gray-500">
          <File className="w-4 h-4 mr-2" />
          <span className="text-sm">PDF files only (max 10MB)</span>
        </div>
      </div>
    </div>
  );
};