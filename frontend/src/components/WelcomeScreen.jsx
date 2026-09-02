import React from 'react';
import { SignInButton } from "@clerk/clerk-react";

function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center bg-white p-10 rounded-lg shadow-sm text-center mt-10">
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">
        Welcome to your AI Pipeline
      </h2>
      <p className="text-gray-600 mb-6">
        Please log in to upload blueprints, process documents, and access your secure vault.
      </p>
      <SignInButton mode="modal">
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors shadow-md">
          Get Started
        </button>
      </SignInButton>
    </div>
  );
}

export default WelcomeScreen;