import React from "react";

const DocumentCard = ({ doc, onDelete }) => {
  return (
    <div className="w-full max-w-full overflow-hidden border border-gray-200 p-3 sm:p-5 rounded-lg shadow-sm bg-white box-border">
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
            onClick={() => onDelete(doc._id)}
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
        <p className="text-gray-800 text-sm leading-relaxed break-words">{doc.aiSummary}</p>
      </div>
    </div>
  );
};

export default DocumentCard;
