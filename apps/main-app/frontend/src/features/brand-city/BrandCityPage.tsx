import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SiteHeader } from '../../shared/layout/SiteHeader';
import { SiteFooter } from '../../shared/layout/SiteFooter';
import { useAuth } from '../auth/AuthContext';

const BRAND_CITY_VIDEO_URL =
  'https://vxjzzhvjuzeeskgzzqmx.supabase.co/storage/v1/object/sign/Helio%20Platform/Brand%20City.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kOWE4ZWYwOS0wZDA4LTRjZTktOGJlNi1mNjNlM2I2NTgyOTgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJIZWxpbyBQbGF0Zm9ybS9CcmFuZCBDaXR5Lm1wNCIsImlhdCI6MTc3NzI5MTY4MywiZXhwIjoxODA4ODI3NjgzfQ.SSSo0XVKOhfw8FKUJBaA2wdvt0wNIEk124rG2DjSdzE';

export default function BrandCityPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [isIntroVisible, setIsIntroVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsIntroVisible(false);
    }, 7500);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const handleVideoEnded = () => {
    setIsVideoEnded(true);
  };

  const handleStart = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-yellow-400 selection:text-neutral-900">
      <SiteHeader isAuthenticated={isAuthenticated} onLoginClick={openAuthModal} />

      <main className="px-4 pb-6 pt-4 md:px-6">
        <section className="mx-auto w-full max-w-[1540px] overflow-hidden bg-[#f2f2f2]">
          <div className="relative min-h-[620px] h-[calc(100vh-150px)]">
            <video
              ref={videoRef}
              src={BRAND_CITY_VIDEO_URL}
              className="absolute inset-0 h-full w-full object-cover object-center"
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={handleVideoEnded}
            >
              Your browser does not support the video tag.
            </video>

            <div className="absolute inset-0 bg-gradient-to-r from-white/42 via-white/22 to-transparent" />

            <div
              className={`absolute left-6 top-8 max-w-[700px] transition-opacity duration-700 md:left-20 md:top-10 lg:left-32 ${
                isIntroVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="h-[2px] w-14 rounded-full bg-[#22ccee]" />
                <span className="text-[28px] font-medium tracking-[-0.01em] text-[#22ccee] md:text-[44px]">Brand City</span>
              </div>

              <h1 className="mb-4 text-[56px] font-normal leading-[0.95] tracking-[-0.03em] text-black md:text-[72px] lg:text-[78px]">
                Step Into Your
                <br />
                Brand City
              </h1>

              <p className="max-w-[620px] text-[20px] leading-[1.45] text-black/75 md:text-[21px]">
                Discover how Bextudio transforms your brand into a living, breathing city - every district, landmark and street aligned with your identity.
              </p>
            </div>

            <div
              className={`absolute inset-0 z-20 flex items-center justify-center transition-all duration-500 ${
                isVideoEnded ? 'bg-neutral-900/60 backdrop-blur-sm opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              <button
                type="button"
                onClick={handleStart}
                className={`group inline-flex items-center gap-3 rounded-full bg-yellow-400 px-8 py-4 text-lg font-semibold text-neutral-900 shadow-2xl transition-all hover:bg-yellow-500 ${
                  isVideoEnded ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'
                }`}
              >
                Let's Start
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter className="mt-0" />
    </div>
  );
}
