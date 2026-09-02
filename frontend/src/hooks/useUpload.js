import { useState, useEffect } from 'react';
import { apiClient } from '../utils/api';

export const useUpload = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); 
  const [jobId, setJobId] = useState(null);

  useEffect(() => {
    let intervalId;

    if (jobId && (status === 'waiting' || status === 'active' || status === 'delayed')) {
      intervalId = setInterval(async () => {
        try {
          // Using apiClient to poll status securely
          const statusRes = await apiClient.get(`/api/upload/status/${jobId}`);
          const currentState = statusRes.data.state;

          setStatus(currentState); 

          if (currentState === 'completed' || currentState === 'failed') {
            clearInterval(intervalId);
            if (currentState === 'completed') {
              setTimeout(() => window.location.reload(), 2000); 
            }
          }
        } catch (err) {
          console.error("Polling failed:", err);
          clearInterval(intervalId);
          setStatus('failed');
        }
      }, 1500); 
    }

    return () => clearInterval(intervalId);
  }, [jobId, status]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a PDF first!");

    const formData = new FormData();
    formData.append('document', file);

    setStatus('waiting');

    try {
      // apiClient handles the base URL and the custom x-user-id header automatically.
      // Axios also automatically sets 'multipart/form-data' when it detects FormData!
      const response = await apiClient.post(`/api/upload`, formData);
      setJobId(response.data.jobId); 
    } catch (error) {
      console.error("Upload failed:", error);
      setStatus('failed');
    }
  };

  const resetUpload = () => {
    setFile(null);
    setStatus('idle');
    setJobId(null);
    document.getElementById('file-upload-input').value = ""; 
  };

  return { setFile, status, handleUpload, resetUpload };
};