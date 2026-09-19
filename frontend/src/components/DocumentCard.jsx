import React from "react";

const DocumentCard = ({ doc, onDelete, onSelect, isSelected }) => {
  return ( 
    <div 
      onClick={onSelect}
      className={`w-full max-w-full overflow-hidden border p-3 sm:p-5 rounded-lg shadow-sm box-border cursor-pointer transition-all ${
        isSelected 
          ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50/40' 
          : 'border-gray-200 bg-white hover:border-blue-300'
      }`}
    >
      {/* Header: Stacked on mobile, horizontal on small screens and up */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3 min-w-0">
        <h3 className="font-semibold text-base sm:text-lg text-blue-600 break-all min-w-0 flex-1">
          📄 {doc.originalName}
        </h3>
        
        {/* Date and Delete button group */}
        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {new Date(doc.createdAt).toLocaleDateString()}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation(); // 🛡️ Prevents clicking "Delete" from also selecting the document
              onDelete(doc._id);
            }}
            className="text-red-400 hover:text-red-600 font-medium text-sm transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="bg-gray-50 p-3 sm:p-4 rounded border-l-4 border-blue-400 overflow-hidden">
        <p className="text-sm font-semibold text-gray-600 mb-1">
          ✨ AI Summary:
        </p>
        <p className="text-gray-800 text-sm leading-relaxed wrap-break-word">{doc.aiSummary}</p>
      </div>

      {/* Visual indicator for the chat status */}
      <div className="mt-3 flex justify-end">
        <span className={`text-xs font-medium ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
          {isSelected ? '✓ Chat Active' : 'Click to Chat →'}
        </span>
      </div>
    </div>
  );
};

export default DocumentCard;
