import React from 'react';
import DocumentCard from './DocumentCard';
import { useDocumentHistory } from '../hooks/useDocumentHistory'; // 1. Import the hook

const DocumentHistory = () => {
  const { documents, loading, deleteDoc } = useDocumentHistory();

  if (loading) {
    return <div className="mt-8 text-center text-gray-500">Loading Vault History...</div>;
  }

  return (
    <div className="mt-12 max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6 border-b pb-2">🗄️ Document Vault History</h2>
      
      {documents.length === 0 ? (
        <p className="text-gray-500 italic">No documents processed yet. Upload a file above!</p>
      ) : (
        <div className="grid gap-6">
          {documents.map((doc) => (
            <DocumentCard key={doc._id} doc={doc} onDelete={deleteDoc}/>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentHistory;