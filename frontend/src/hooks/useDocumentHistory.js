import { useState, useEffect } from "react";
import { apiClient } from '../utils/api';

export const useDocumentHistory = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // apiClient automatically includes the x-user-id header!
        const response = await apiClient.get('/api/upload/history');
        setDocuments(response.data); // Axios puts the JSON in .data
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
      const response = await apiClient.delete(`/api/upload/${id}`);

      // Axios throws an error for non-2xx status, so if we reach here, it was successful
      if (response.status === 200 || response.status === 204) {
        setDocuments((prevDocs) => prevDocs.filter((doc) => doc._id !== id));
      }
    } catch (error) {
      console.error("❌ Failed to delete document:", error);
    }
  };

  return { documents, loading, deleteDoc };
};