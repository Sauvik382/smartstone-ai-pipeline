import { SignedIn, SignedOut } from "@clerk/clerk-react";
import Navbar from "./components/Navbar";
import WelcomeScreen from "./components/WelcomeScreen";
import UploadSection from "./components/UploadSection";
import DocumentHistory from "./components/DocumentHistory";

function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <Navbar />
      
      <main className="max-w-5xl mx-auto">
        <SignedIn>
          <UploadSection />
          <DocumentHistory />
        </SignedIn>

        <SignedOut>
          <WelcomeScreen />
        </SignedOut>
      </main>
    </div>
  );
}

export default App;