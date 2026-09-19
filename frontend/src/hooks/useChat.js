// src/hooks/useChat.js
import { useState } from 'react';
import { apiClient } from '../utils/api'; // Adjust path if your apiClient is stored elsewhere (e.g., ../config/api)

export const useChat = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async (docId, question) => {
    if (!question.trim() || !docId) return;

    // 1. Immediately append the user's question to the chat history
    const userMsg = { role: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // 2. Post question and document ID to your backend chat route
      const response = await apiClient.post('/api/chat', {
        docId: docId,
        question: question,
      });

      // 3. Append the AI's response to the chat history
      const aiMsg = { role: 'ai', text: response.data.answer };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      const errorMsg = {
        role: 'ai',
        text: 'Sorry, I ran into an issue finding an answer in the document. Please try again.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => setMessages([]);

  return { messages, loading, sendMessage, clearChat };
};