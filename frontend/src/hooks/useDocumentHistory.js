import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { API_BASE_URL } from '../config/api';

export const useDocumentHistory = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/upload/history`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
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
  }, [getToken]);

  const deleteDoc = async (id) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/upload/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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