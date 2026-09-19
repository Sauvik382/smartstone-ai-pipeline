// src/components/DocumentVault.jsx
import React, { useState } from "react";
import DocumentHistory from "./DocumentHistory";
import { ChatBox } from "./ChatBox";

const DocumentVault = () => {
  const [selectedDoc, setSelectedDoc] = useState(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column: History List */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Your Document Vault
        </h2>
        <DocumentHistory
          onSelectDocument={(doc) => setSelectedDoc(doc)}
          selectedDocId={selectedDoc?._id}
        />
      </div>

      {/* Right Column: Interactive Chat Box */}
      <div>
        <ChatBox selectedDoc={selectedDoc} />
      </div>
    </div>
  );
};

export default DocumentVault;