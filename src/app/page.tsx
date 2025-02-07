'use client';

import { useState } from 'react';
import { PDFUploader } from '@/components/PDFUploader';
import { PDFViewer } from '@/components/PDFViewer';
import { Layout } from '@/components/Layout';

export default function Home() {
  // State to store the selected PDF file
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <Layout>
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {/* Page title */}
          <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
            PDF Reader
          </h1>

          {/* PDF uploader component */}
          <div className="mb-8">
            <PDFUploader onFileSelect={setSelectedFile} />
          </div>

          {/* Conditionally render the PDF viewer if a file is selected */}
          {selectedFile && (
            <div className="mt-8">
              <PDFViewer file={selectedFile} />
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}

