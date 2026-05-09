import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ImageGeneratorChat } from './ImageGeneratorChat';

export default function ImageGeneratorPage() {
  const { isAuthenticated, openAuthModal } = useAuth();

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-[#22ccee] selection:text-neutral-900 flex flex-col">
      <main className="flex-1 bg-neutral-50 py-8 sm:py-12 flex flex-col">
        <div className="mx-auto w-full max-w-4xl px-6 lg:px-8 flex-1 flex flex-col">
          <ImageGeneratorChat
            requireAuth
            isAuthenticated={isAuthenticated}
            onRequestAuth={openAuthModal}
          />
        </div>
      </main>
    </div>
  );
}
