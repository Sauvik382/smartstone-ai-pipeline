import React from "react";

const DocumentCard = ({ doc, onDelete }) => {
  return (
    <div className="border border-gray-200 p-5 rounded-lg shadow-sm bg-white">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-lg text-blue-600">
          📄 {doc.originalName}
        </h3>
        <span className="text-xs text-gray-400">
          {new Date(doc.createdAt).toLocaleDateString()}
        </span>
        <button
          onClick={() => onDelete(doc._id)}
          className="text-red-400 hover:text-red-600 font-medium text-sm transition-colors"
        >
          Delete
        </button>
      </div>

      <div className="bg-gray-50 p-4 rounded border-l-4 border-blue-400">
        <p className="text-sm font-semibold text-gray-600 mb-1">
          ✨ AI Summary:
        </p>
        <p className="text-gray-800 text-sm leading-relaxed">{doc.aiSummary}</p>
      </div>
    </div>
  );
};

export default DocumentCard;
