import { useState, useEffect } from 'react';
import { apiClient } from '../utils/api';
import toast from 'react-hot-toast'; // 1. Imported toast library

export const useUpload = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); 
  const [jobId, setJobId] = useState(null);

  useEffect(() => {
    let intervalId;

    if (jobId && (status === 'waiting' || status === 'active' || status === 'delayed')) {
      intervalId = setInterval(async () => {
        try {
          const statusRes = await apiClient.get(`/api/upload/status/${jobId}`);
          const currentState = statusRes.data.state;

          setStatus(currentState); 

          if (currentState === 'completed' || currentState === 'failed') {
            clearInterval(intervalId);
            
            if (currentState === 'completed') {
              // 2. Success toast triggered when BullMQ finishes safely
              toast.success('Document vaulted successfully!');
              setTimeout(() => window.location.reload(), 2000); 
            } else if (currentState === 'failed') {
              // 3. Error toast if the worker crashes (e.g., scanned PDF)
              toast.error('Failed to process document. Is it a scanned image?');
            }
          }
        } catch (err) {
          console.error("Polling failed:", err);
          clearInterval(intervalId);
          setStatus('failed');
          toast.error('Lost connection to the server while processing.');
        }
      }, 1500); 
    }

    return () => clearInterval(intervalId);
  }, [jobId, status]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      // 4. Replaced the ugly native alert with a sleek toast
      toast.error("Please select a PDF first!");
      return;
    }

    const formData = new FormData();
    formData.append('document', file);

    setStatus('waiting');

    try {
      const response = await apiClient.post(`/api/upload`, formData);
      setJobId(response.data.jobId); 
    } catch (error) {
      console.error("Upload failed:", error);
      setStatus('failed');
      toast.error("Upload failed. Please try again.");
    }
  };

  const resetUpload = () => {
    setFile(null);
    setStatus('idle');
    setJobId(null);
    const fileInput = document.getElementById('file-upload-input');
    if (fileInput) fileInput.value = ""; 
  };

  return { setFile, status, handleUpload, resetUpload };
};