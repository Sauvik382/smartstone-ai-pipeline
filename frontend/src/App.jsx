// src/App.jsx
import { Toaster } from 'react-hot-toast';
import Navbar from "./components/Navbar";
import UploadSection from "./components/UploadSection";
import DocumentVault from "./components/DocumentVault";

function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <Navbar />
      <Toaster position="top-right" />

      <main className="max-w-5xl mx-auto space-y-8">
        <UploadSection />
        <DocumentVault />
      </main>
    </div>
  );
}

export default App;