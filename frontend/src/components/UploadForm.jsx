import React from 'react';

function UploadForm({ onFileSelect, onUploadSubmit, status, onReset }) {
  const isProcessing = status === 'waiting' || status === 'active' || status === 'delayed';

  return (
    <form 
      onSubmit={onUploadSubmit} 
      className="flex flex-row items-center gap-4"
    >
      <input
        id="file-upload-input" 
        type="file"
        accept="application/pdf"
        onChange={(e) => onFileSelect(e.target.files[0])}
        className="border p-2 rounded file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      
      <div className="flex flex-row gap-2">
        <button 
          type="submit" 
          disabled={isProcessing}
          className="bg-blue-600 text-white py-2 px-4 rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors whitespace-nowrap"
        >
          {isProcessing ? 'Processing...' : 'Process Document'}
        </button>
        
        {status === 'failed' && (
          <button 
            type="button" 
            onClick={onReset}
            className="bg-gray-200 text-gray-700 py-2 px-4 rounded font-medium hover:bg-gray-300 transition-colors whitespace-nowrap"
          >
            Clear File
          </button>
        )}
      </div>
    </form>
  );
}

export default UploadForm;