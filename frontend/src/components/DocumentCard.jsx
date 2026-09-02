import React from "react";

const DocumentCard = ({ doc, onDelete }) => {
  return (
    <div className="w-full max-w-full overflow-hidden border border-gray-200 p-3 sm:p-4 md:p-5 rounded-lg shadow-sm bg-white box-border">
      
      {/* Header section: Stacked on mobile, horizontal on desktop */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-3 min-w-0">
        <h3 className="font-semibold text-sm sm:text-base md:text-lg text-blue-600 break-all min-w-0 flex-1">
          📄 {doc.originalName}
        </h3>
        
        {/* Date and Delete Button container */}
        <div className="flex justify-between items-center w-full md:w-auto md:gap-4 mt-1 md:mt-0 min-w-0">
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {new Date(doc.createdAt).toLocaleDateString()}
          </span>
          <button
            onClick={() => onDelete(doc._id)}
            className="text-red-400 hover:text-red-600 font-medium text-sm transition-colors bg-red-50 md:bg-transparent px-2 md:px-0 py-1 md:py-0 rounded shrink-0"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Summary section */}
      <div className="bg-gray-50 p-3 md:p-4 rounded border-l-4 border-blue-400 overflow-hidden max-w-full">
        <p className="text-sm font-semibold text-gray-600 mb-1">
          ✨ AI Summary:
        </p>
        <p className="text-gray-800 text-xs sm:text-sm leading-relaxed break-words overflow-wrap-anywhere">
          {doc.aiSummary}
        </p>
      </div>
    </div>
  );
};

export default DocumentCard;