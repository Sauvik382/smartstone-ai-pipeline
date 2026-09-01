import { useState, useEffect } from "react";

export const useDocumentHistory = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/upload/history",
        );
        const data = await response.json();
        setDocuments(data);
        setLoading(false);
      } catch (error) {
        console.error("❌ Failed to fetch history:", error);
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const deleteDoc = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/upload/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Instantly remove the deleted doc from the UI state!
        setDocuments((prevDocs) => prevDocs.filter((doc) => doc._id !== id));
      }
    } catch (error) {
      console.error("❌ Failed to delete document:", error);
    }
  };

  // The hook just returns the data your UI needs
  return { documents, loading, deleteDoc };
};
