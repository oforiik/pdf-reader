'use client';

import { useState } from 'react';
import { PDFViewer } from './PDFViewer';

interface PDFUploaderProps {
  onFileSelect: (file: File | null) => void; // Define the prop
}

export const PDFUploader = ({ onFileSelect }: PDFUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files[0]) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name);
      onFileSelect(selectedFile); // Pass the selected file to the parent
    } else {
      setFile(null);
      setFileName('');
      onFileSelect(null); // Clear the selected file in the parent
    }
  };

  return (
    <div className="p-6">
      {!file ? (
        <div className="flex flex-col items-center justify-center min-h-[80vh]">
          <h1 className="text-3xl font-semibold text-[#5d87ff] mb-8">PDF Reader</h1>
          <div className="relative">
            <input
              type="file"
              onChange={handleFileChange}
              accept="application/pdf"
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer px-6 py-3 bg-[#5d87ff] hover:bg-[#4a6cd9] text-white rounded-lg text-lg font-medium transition-colors"
            >
              Upload PDF
            </label>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium text-gray-800 truncate">
                {fileName}
              </h2>
              <label
                htmlFor="file-upload"
                className="cursor-pointer px-4 py-2 text-[#5d87ff] hover:bg-gray-50 rounded-lg transition-colors text-sm"
              >
                Change File
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                accept="application/pdf"
                className="hidden"
                id="file-upload"
              />
            </div>
          </div>
          <PDFViewer file={file} />
        </div>
      )}
    </div>
  );
};