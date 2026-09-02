import { useState, useEffect } from "react";
import { API_BASE_URL } from '../config/api';

export const useDocumentHistory = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/upload/history`);
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
      const response = await fetch(`${API_BASE_URL}/api/upload/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDocuments((prevDocs) => prevDocs.filter((doc) => doc._id !== id));
      }
    } catch (error) {
      console.error("❌ Failed to delete document:", error);
    }
  };

  return { documents, loading, deleteDoc };
};