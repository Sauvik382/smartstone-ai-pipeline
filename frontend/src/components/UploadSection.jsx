import React from 'react';
import UploadForm from './UploadForm';
import { useUpload } from '../hooks/useUpload'; 

const UploadSection = () => {
  // Grab the new reset function from the hook
  const { setFile, status, handleUpload, resetUpload } = useUpload();

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-lg shadow-md mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload New Blueprint</h2>
      
      <UploadForm 
        onFileSelect={setFile} 
        onUploadSubmit={handleUpload} 
        status={status} 
        onReset={resetUpload} // Pass it into the form
      />

      {status !== 'idle' && (
        <div className="mt-6 p-4 rounded bg-gray-50 border text-center">
          {status === 'waiting' && <p className="text-yellow-600 font-medium">⏳ Placed in queue...</p>}
          {status === 'active' && <p className="text-blue-600 font-medium animate-pulse">🧑‍🍳 AI Chef is analyzing your document...</p>}
          
          {/* NEW: Let the user know it is in the retry queue! */}
          {status === 'delayed' && <p className="text-orange-500 font-medium animate-pulse">⚠️ Google is busy. Waiting to retry...</p>}
          
          {status === 'completed' && <p className="text-green-600 font-medium">✅ Success! Document analyzed and saved.</p>}
          
          {/* Updated the fail message */}
          {status === 'failed' && <p className="text-red-600 font-medium">❌ Upload failed. Click 'Clear File' to reset.</p>}
        </div>
      )}
    </div>
  );
};

export default UploadSection;