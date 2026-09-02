import React from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

function Navbar() {
  return (
    <header className="max-w-5xl mx-auto flex justify-between items-center bg-white p-4 rounded-lg shadow-sm mb-8">
      <h1 className="text-xl md:text-2xl font-bold text-blue-600">
        Smartstone AI Vault
      </h1>
      
      <div>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded transition-colors">
              Log In
            </button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
}

export default Navbar;