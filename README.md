# Smartstone Vault: Full-Stack RAG Document Pipeline

An enterprise-grade Retrieval-Augmented Generation (RAG) system that allows users to upload PDFs, generate vector embeddings, and chat with their documents in real-time. 

## 🏗 Architecture & Tech Stack
* **Frontend:** React, Tailwind CSS, Vercel (Auto-scrolling Markdown Chat UI)
* **Backend:** Node.js, Express, Render
* **Message Queue:** Redis + BullMQ (For asynchronous document parsing)
* **Databases:** 
  * **MongoDB Atlas:** Stores document metadata and AI-generated summaries.
  * **Pinecone:** Vector database for semantic search (strictly enforced 768-dimensional chunks).
* **AI Models (Google Gemini):**
  * `gemini-embedding-001` with Matryoshka Representation Learning (MRL) for vector generation.
  * `gemini-3.6-flash` (with 3.5 fallback) for text generation and summarization.

## 🚀 Key Engineering Features
* **Asynchronous Processing:** PDF extraction and embedding generation are offloaded to BullMQ background workers, preventing backend timeouts on large documents.
* **Vector Mathematical Parity:** Implemented strict L2 Normalization and dimensionality slicing (down to 768 dimensions) to ensure Gemini's Matryoshka embeddings perfectly match Pinecone's indexing requirements without distorting cosine similarity.
* **Resilient SDK Upserting:** Built an omni-strategy Pinecone upsert wrapper with deep TypedArray extraction (`ArrayBuffer.isView`) to bypass strict SDK payload rejections and prevent silent vector drops.
* **Auto-Cleanup Protocol:** The worker automatically wipes database records upon reaching 50 documents to manage server storage efficiently.
* **Device-Based Authentication:** Uses `x-user-id` local storage headers to securely partition document vector searches by user.

## ⚙️ Local Setup
1. Clone the repository.
2. Add your `.env` variables (`MONGO_URI`, `PINECONE_API_KEY`, `GEMINI_API_KEY`, `REDIS_URL`).
3. Run `npm install` in both the `frontend` and `backend` directories.
4. Start the backend worker and server: `npm run dev`.
5. Start the React frontend: `npm run dev`.