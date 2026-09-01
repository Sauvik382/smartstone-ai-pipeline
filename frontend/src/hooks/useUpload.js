import { useState, useEffect } from 'react';
import axios from 'axios';

import { API_BASE_URL } from '../config/api';

export const useUpload = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); 
  const [jobId, setJobId] = useState(null);

  useEffect(() => {
    let intervalId;

    if (jobId && (status === 'waiting' || status === 'active' || status === 'delayed')) {
      intervalId = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${API_BASE_URL}/api/upload/status/${jobId}`);
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
      const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setJobId(response.data.jobId); 
    } catch (error) {
      console.error(error);
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