import React, { useEffect, useRef, useState } from 'react';
import { Bot, Download, Send, Shield, User, Video } from 'lucide-react';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';
import { useAuth } from '../context/AuthContext';
import {
  IMAGE_GENERATION_API_URL,
  VIDEO_GENERATION_API_URL,
  VIDEO_IMAGE_PROMPT_API_URL,
  VIDEO_PROMPT_FROM_IMAGE_API_URL,
} from '../config/site';
import mansoryLogo from '../assets/brand-references/mansory.png';
import technogymLogo from '../assets/brand-references/technogym.png';
import binghattiLogo from '../assets/brand-references/binghatti.png';
import binghattiPattern from '../assets/brand-references/binghatti-pattern.jpg';

type BrandKey = 'Mansory' | 'Technogym' | 'Binghatti';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  imageBrand?: BrandKey;
}

interface ApiResponse {
  detail?: string;
  error?: string;
}

const BRAND_OPTIONS: BrandKey[] = ['Mansory', 'Technogym', 'Binghatti'];

const BRAND_REFERENCE_URLS: Record<BrandKey, string[]> = {
  Mansory: [mansoryLogo],
  Technogym: [technogymLogo],
  Binghatti: [binghattiLogo, binghattiPattern],
};

const SYSTEM_PROMPT_LEAK_MARKERS = [
  'you are the dedicated',
  'primary objective',
  'execution instructions',
  'user image request',
  'output format',
  'final internal check',
  'act video rule',
];

const sanitizeErrorMessage = (message: string, fallback: string): string => {
  const compact = message.trim().replace(/\s+/g, ' ');
  if (!compact) {
    return fallback;
  }
  const normalized = compact.toLowerCase();
  const leaked = SYSTEM_PROMPT_LEAK_MARKERS.some((marker) => normalized.includes(marker));
  if (leaked || compact.length > 420) {
    return fallback;
  }
  return compact;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image asset.'));
    reader.readAsDataURL(blob);
  });

const parseApiError = (status: number, payload: string): string => {
  const fallbackMessage = `Request failed with status ${status}.`;
  let message = fallbackMessage;

  try {
    const parsed = JSON.parse(payload) as ApiResponse & Record<string, unknown>;
    message =
      (typeof parsed.detail === 'string' && parsed.detail) ||
      (typeof parsed.error === 'string' && parsed.error) ||
      (typeof parsed.message === 'string' && parsed.message) ||
      message;
  } catch {
    if (payload.trim()) {
      message = payload.trim();
    }
  }

  return sanitizeErrorMessage(message, fallbackMessage);
};

export default function VideoGeneratorPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [selectedBrand, setSelectedBrand] = useState<BrandKey>('Mansory');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('Generating...');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const brandReferenceCacheRef = useRef<Partial<Record<BrandKey, string[]>>>({});

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, loadingStage]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    setMessages((prev) => {
      if (prev.length > 0) {
        return prev;
      }

      return [
        {
          role: 'assistant',
          content: 'Welcome to Video Generator Agent.',
        },
      ];
    });
  }, [isAuthenticated]);

  const resolveBrandReferenceDataUrls = async (brand: BrandKey): Promise<string[]> => {
    const cached = brandReferenceCacheRef.current[brand];
    if (cached && cached.length > 0) {
      return cached;
    }

    const assetUrls = BRAND_REFERENCE_URLS[brand];
    const dataUrls: string[] = [];
    for (const assetUrl of assetUrls) {
      const assetResponse = await fetch(assetUrl);
      if (!assetResponse.ok) {
        throw new Error(`Could not load brand reference asset for ${brand}.`);
      }
      const assetBlob = await assetResponse.blob();
      dataUrls.push(await blobToDataUrl(assetBlob));
    }

    brandReferenceCacheRef.current[brand] = dataUrls;
    return dataUrls;
  };

  const downloadFile = async (url: string, fileName: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}.`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  };

  const handleDownload = async (url: string, fileName: string, fallbackLabel: string) => {
    try {
      await downloadFile(url, fileName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : `Could not download the generated ${fallbackLabel}.`;
      window.open(url, '_blank', 'noopener,noreferrer');
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMessage }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) {
      return;
    }

    const userRequest = input.trim();
    setInput('');
    const userMessage: Message = { role: 'user', content: userRequest };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 480000);

    try {
      setLoadingStage('Generating (1/4)...');
      const imagePromptResponse = await fetch(VIDEO_IMAGE_PROMPT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: selectedBrand,
          user_request: userRequest,
        }),
        signal: controller.signal,
      });
      if (!imagePromptResponse.ok) {
        throw new Error(parseApiError(imagePromptResponse.status, await imagePromptResponse.text()));
      }
      const imagePromptPayload = (await imagePromptResponse.json()) as { image_prompt?: string };
      const imagePrompt = (imagePromptPayload.image_prompt || '').trim();
      if (!imagePrompt) {
        throw new Error('LLM did not return an image prompt.');
      }

      setLoadingStage('Generating (2/4)...');
      const referenceImages = await resolveBrandReferenceDataUrls(selectedBrand);
      const imageGenerationResponse = await fetch(IMAGE_GENERATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          image_input: referenceImages,
          brand: selectedBrand,
        }),
        signal: controller.signal,
      });
      if (!imageGenerationResponse.ok) {
        throw new Error(parseApiError(imageGenerationResponse.status, await imageGenerationResponse.text()));
      }
      const imagePayload = (await imageGenerationResponse.json()) as { image_url?: string };
      const imageUrl = (imagePayload.image_url || '').trim();
      if (!imageUrl) {
        throw new Error('Image generation completed without image_url.');
      }

      setLoadingStage('Generating (3/4)...');
      const videoPromptResponse = await fetch(VIDEO_PROMPT_FROM_IMAGE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: selectedBrand,
          user_request: userRequest,
          image_url: imageUrl,
        }),
        signal: controller.signal,
      });
      if (!videoPromptResponse.ok) {
        throw new Error(parseApiError(videoPromptResponse.status, await videoPromptResponse.text()));
      }
      const videoPromptPayload = (await videoPromptResponse.json()) as { video_prompt?: string };
      const videoPrompt = (videoPromptPayload.video_prompt || '').trim();
      if (!videoPrompt) {
        throw new Error('Prompt generation returned empty output.');
      }

      setLoadingStage('Generating (4/4)...');
      const videoGenerationResponse = await fetch(VIDEO_GENERATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          video_prompt: videoPrompt,
          duration: 5,
        }),
        signal: controller.signal,
      });
      if (!videoGenerationResponse.ok) {
        throw new Error(parseApiError(videoGenerationResponse.status, await videoGenerationResponse.text()));
      }
      const videoPayload = (await videoGenerationResponse.json()) as { video_url?: string };
      const videoUrl = (videoPayload.video_url || '').trim();
      if (!videoUrl) {
        throw new Error('Video generation completed without video_url.');
      }

      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: 'Video generated successfully.',
          imageUrl,
          videoUrl,
          imageBrand: selectedBrand,
        },
      ]);
    } catch (error) {
      let errorMessage = 'Sorry, video generation failed. Please try again.';
      if (error instanceof Error && error.name === 'AbortError') {
        errorMessage = 'Generation timed out. Please try again.';
      } else if (error instanceof TypeError) {
        errorMessage = 'Video generation service is not reachable. Make sure HelioGram backend is running on port 8010.';
      } else if (error instanceof Error && error.message) {
        errorMessage = error.message;
      }
      setMessages([...nextMessages, { role: 'assistant', content: errorMessage }]);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
      setLoadingStage('Generating...');
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-yellow-400 selection:text-neutral-900 flex flex-col">
      <SiteHeader isAuthenticated={isAuthenticated} onLoginClick={openAuthModal} />

      <main className="flex-1 bg-neutral-50 py-8 sm:py-12 flex flex-col">
        <div className="mx-auto w-full max-w-4xl px-6 lg:px-8 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Video Generator Agent</h1>
              <p className="text-sm text-neutral-500 mt-1">
                Prompt-to-image-to-video pipeline.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 flex-1 flex flex-col overflow-hidden min-h-[500px]">
            {!isAuthenticated ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                  <Shield className="size-8 text-neutral-400" />
                </div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">Authentication Required</h2>
                <p className="text-neutral-500 mb-6 max-w-md">
                  You need to be logged in as an administrator to access this agent.
                </p>
                <button
                  onClick={openAuthModal}
                  className="bg-yellow-400 hover:bg-yellow-500 text-neutral-900 px-6 py-2.5 rounded-md text-sm font-semibold transition-colors"
                >
                  Log in to continue
                </button>
              </div>
            ) : (
              <>
                <div className="px-6 pt-5 pb-4 border-b border-neutral-100">
                  <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase mb-3">Select Brand</p>
                  <div className="flex flex-wrap gap-2">
                    {BRAND_OPTIONS.map((brand) => {
                      const isActive = selectedBrand === brand;
                      return (
                        <button
                          key={brand}
                          type="button"
                          onClick={() => setSelectedBrand(brand)}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                            isActive
                              ? 'bg-yellow-400 border-yellow-400 text-neutral-900'
                              : 'bg-white border-neutral-200 text-neutral-600 hover:border-yellow-400 hover:text-neutral-900'
                          }`}
                        >
                          {brand}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4">
                      <Video className="size-12 text-neutral-300" />
                      <p>Describe your video idea to generate the first result.</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            msg.role === 'user'
                              ? 'bg-neutral-900 text-white'
                              : 'bg-neutral-100 text-yellow-400 border border-neutral-200'
                          }`}
                        >
                          {msg.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
                        </div>
                        <div
                          className={`max-w-[88%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-neutral-900 text-white rounded-tr-sm'
                              : 'bg-neutral-100 text-neutral-800 rounded-tl-sm'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                          {msg.imageUrl && (
                            <div className="mt-4 space-y-3">
                              <div className="w-full rounded-xl border border-neutral-200 bg-white overflow-hidden">
                                <img
                                  src={msg.imageUrl}
                                  alt="Generated keyframe"
                                  className="w-full h-auto object-cover"
                                  loading="lazy"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDownload(
                                    msg.imageUrl ?? '',
                                    `${(msg.imageBrand ?? selectedBrand).toLowerCase()}-video-keyframe-${Date.now()}.png`,
                                    'keyframe',
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-yellow-400 hover:text-neutral-900 transition-colors"
                              >
                                <Download className="size-3.5" />
                                Download Keyframe
                              </button>
                            </div>
                          )}
                          {msg.videoUrl && (
                            <div className="mt-4 space-y-3">
                              <div className="w-full rounded-xl border border-neutral-200 bg-white overflow-hidden">
                                <video
                                  src={msg.videoUrl}
                                  controls
                                  className="w-full h-auto object-cover bg-black"
                                  preload="metadata"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDownload(
                                    msg.videoUrl ?? '',
                                    `${(msg.imageBrand ?? selectedBrand).toLowerCase()}-video-${Date.now()}.mp4`,
                                    'video',
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-yellow-400 hover:text-neutral-900 transition-colors"
                              >
                                <Download className="size-3.5" />
                                Download Video
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {isLoading && (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 text-yellow-400 border border-neutral-200 flex items-center justify-center shrink-0">
                        <Bot className="size-4" />
                      </div>
                      <div className="bg-neutral-100 rounded-2xl rounded-tl-sm px-5 py-4">
                        <span className="text-sm text-neutral-700 font-medium">{loadingStage}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white border-t border-neutral-100">
                  <div className="relative flex items-end gap-2">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={1}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-4 pr-12 py-3.5 text-sm text-neutral-900 focus:outline-none focus:border-yellow-400 focus:ring-0 transition-all resize-none max-h-32"
                      placeholder="Describe the video you want..."
                      style={{ minHeight: '52px' }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={isLoading || !input.trim()}
                      className="absolute right-2 bottom-2 w-9 h-9 flex items-center justify-center bg-yellow-400 hover:bg-yellow-500 disabled:bg-neutral-200 disabled:text-neutral-400 text-neutral-900 rounded-lg transition-colors"
                    >
                      <Send className="size-4 ml-0.5" />
                    </button>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 text-center">
                    Hidden prompt flow.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
