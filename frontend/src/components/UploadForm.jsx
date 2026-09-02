import React from 'react';

function UploadForm({ onFileSelect, onUploadSubmit, status, onReset }) {
  const isProcessing = status === 'waiting' || status === 'active' || status === 'delayed';

  return (
    <form 
      onSubmit={onUploadSubmit} 
      className="flex flex-col md:flex-row items-center gap-4 w-full"
    >
      <input
        id="file-upload-input" 
        type="file"
        accept="application/pdf"
        onChange={(e) => onFileSelect(e.target.files[0])}
        disabled={isProcessing} 
        className="w-full md:w-auto border p-2 rounded disabled:opacity-50 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:file:bg-gray-200 disabled:file:text-gray-500"
      />
      
      
      <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
        <button 
          type="submit" 
          disabled={isProcessing}
          className="w-full sm:w-auto bg-blue-600 text-white py-2 px-4 rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {isProcessing ? 'Processing...' : 'Process Document'}
        </button>
        
        {status === 'failed' && (
          <button 
            type="button" 
            onClick={onReset}
            className="w-full sm:w-auto bg-gray-200 text-gray-700 py-2 px-4 rounded font-medium hover:bg-gray-300 transition-colors whitespace-nowrap"
          >
            Clear File
          </button>
        )}
      </div>
    </form>
  );
}

export default UploadForm;