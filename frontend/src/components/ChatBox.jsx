// src/components/ChatBox.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import ReactMarkdown from 'react-markdown'; // Ensure this is imported

export const ChatBox = ({ selectedDoc }) => {
  const [question, setQuestion] = useState('');
  const { messages, loading, sendMessage, clearChat } = useChat();
  
  // 1. Create the reference anchor
  const messagesEndRef = useRef(null);

  // 2. Smooth scrolling function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 3. Trigger scroll whenever a new message arrives or loading starts
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || !selectedDoc) return;
    
    // Send the document's database ID and the typed question
    sendMessage(selectedDoc._id, question);
    setQuestion('');
  };

  if (!selectedDoc) {
    return (
      <div className="p-6 text-center text-gray-500 border rounded-lg bg-gray-50">
        <p>Select a document from your vault history to start chatting!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-125 border rounded-lg bg-white shadow-sm">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800 truncate">
          💬 Chat: {selectedDoc.originalName || selectedDoc.filename}
        </h3>
        <button
          onClick={clearChat}
          className="text-xs text-gray-500 hover:text-red-500 underline"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-center text-gray-400 mt-10">
            Ask any question about this document...
          </p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}
              >
                {/* Markdown wrapper applied cleanly */}
                <ReactMarkdown className="markdown-body space-y-2">
                  {msg.text}
                </ReactMarkdown>
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 text-sm p-3 rounded-lg animate-pulse">
              Searching vector vault & generating answer...
            </div>
          </div>
        )}
        
        {/* 4. The invisible anchor dynamically pushed to the bottom */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 border-t flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this file..."
          disabled={loading}
          className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
};