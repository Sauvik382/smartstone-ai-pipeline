import UploadSection from "./components/UploadSection";
import DocumentHistory from "./components/DocumentHistory";

function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-center mb-8">
        AI Pipeline Upload
      </h1>

      <UploadSection />

      <DocumentHistory />
    </div>
  );
}

export default App;
