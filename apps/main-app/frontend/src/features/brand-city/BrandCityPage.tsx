import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { SiteHeader } from '../../shared/layout/SiteHeader';
import { SiteFooter } from '../../shared/layout/SiteFooter';
import { useAuth } from '../auth/AuthContext';

const BRAND_CITY_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

export default function BrandCityPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const handleVideoEnded = () => {
    setIsVideoEnded(true);
  };

  const handleToggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setIsMuted(next);
  };

  const handleStart = () => {
    navigate('/questionnaire');
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-yellow-400 selection:text-neutral-900">
      <SiteHeader isAuthenticated={isAuthenticated} onLoginClick={openAuthModal} />

      <main>
        <section className="relative overflow-hidden bg-white pt-16 pb-10 sm:pt-20 sm:pb-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                <span className="text-sm font-medium text-neutral-700">Brand City</span>
              </div>
              <h1 className="mb-6 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
                Step Into Your <span className="text-yellow-400">Brand City</span>
              </h1>
              <p className="text-lg text-neutral-600 sm:text-xl">
                Discover how Helio transforms your brand into a living, breathing city — every district, landmark and street aligned with your identity.
              </p>
            </div>
          </div>
          <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl pointer-events-none" aria-hidden="true">
            <div className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-yellow-100 to-yellow-50 opacity-30"></div>
          </div>
        </section>

        <section className="px-6 lg:px-8 max-w-5xl mx-auto pb-20 sm:pb-28">
          {/* Glassmorphism frame */}
          <div className="relative rounded-[2rem] p-3 sm:p-4 shadow-2xl
                          bg-gradient-to-br from-white/70 via-white/20 to-neutral-900/40
                          backdrop-blur-xl
                          ring-1 ring-white/40
                          before:pointer-events-none before:absolute before:inset-0 before:rounded-[2rem]
                          before:bg-gradient-to-br before:from-white/40 before:via-transparent before:to-transparent
                          before:opacity-60 before:mix-blend-overlay
                          after:pointer-events-none after:absolute after:inset-0 after:rounded-[2rem]
                          after:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),inset_0_-1px_0_0_rgba(0,0,0,0.25)]">
            <div className="relative rounded-[1.4rem] overflow-hidden bg-neutral-900 aspect-video ring-1 ring-white/20">
              <video
                ref={videoRef}
                src={BRAND_CITY_VIDEO_URL}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                preload="auto"
                onEnded={handleVideoEnded}
              >
                Your browser does not support the video tag.
              </video>

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center shadow-md hover:scale-105 transition-transform text-neutral-900 ring-1 ring-white/60"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <div
                className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                  isVideoEnded
                    ? 'bg-neutral-900/60 backdrop-blur-sm opacity-100 pointer-events-auto'
                    : 'opacity-0 pointer-events-none'
                }`}
              >
                <button
                  type="button"
                  onClick={handleStart}
                  className={`group inline-flex items-center gap-3 rounded-full bg-yellow-400 hover:bg-yellow-500 text-neutral-900 px-8 py-4 text-lg font-semibold shadow-2xl transition-all ${
                    isVideoEnded ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'
                  }`}
                >
                  Let's Start
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
