import React, { useEffect, useRef, useState } from 'react';
import { Bot, Download, Image as ImageIcon, Send, Shield, User } from 'lucide-react';
import { SiteHeader } from '../../../shared/layout/SiteHeader';
import { SiteFooter } from '../../../shared/layout/SiteFooter';
import { useAuth } from '../../auth/AuthContext';
import { IMAGE_GENERATION_API_URL, IMAGE_PROMPT_API_URL } from '../../../shared/config/site';
import mansoryLogo from '../../../assets/brand-references/mansory.png';
import technogymLogo from '../../../assets/brand-references/technogym.png';
import binghattiLogo from '../../../assets/brand-references/binghatti.png';
import binghattiPattern from '../../../assets/brand-references/binghatti-pattern.jpg';

type BrandKey = 'Mansory' | 'Technogym' | 'Binghatti';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  imageBrand?: BrandKey;
}

interface ImageGenerationResponse {
  image_url?: string;
  detail?: string;
  error?: string;
}

interface ImagePromptResponse {
  final_prompt?: string;
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
  'scene type routing',
  'prompt construction order',
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

const parseApiError = (status: number, payload: string): string => {
  const fallbackMessage = `Image generation failed with status ${status}.`;
  let message = fallbackMessage;

  try {
    const parsed = JSON.parse(payload);
    message = parsed?.detail || parsed?.error || parsed?.message || message;
  } catch {
    if (payload.trim()) {
      message = payload.trim();
    }
  }

  return sanitizeErrorMessage(message, fallbackMessage);
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image asset.'));
    reader.readAsDataURL(blob);
  });

export default function ImageGeneratorPage() {
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
          content: 'Welcome to Image Generator Agent.',
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
      const dataUrl = await blobToDataUrl(assetBlob);
      dataUrls.push(dataUrl);
    }

    brandReferenceCacheRef.current[brand] = dataUrls;
    return dataUrls;
  };

  const handleDownload = async (imageUrl: string, brand: BrandKey) => {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}.`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${brand.toLowerCase()}-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not download the generated image.';
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
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
    const timeoutId = setTimeout(() => controller.abort(), 240000);

    try {
      setLoadingStage('Generating (1/2)...');
      const imagePromptResponse = await fetch(IMAGE_PROMPT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand: selectedBrand,
          user_request: userRequest,
        }),
        signal: controller.signal,
      });

      if (!imagePromptResponse.ok) {
        const errorText = await imagePromptResponse.text();
        throw new Error(parseApiError(imagePromptResponse.status, errorText));
      }

      const imagePromptPayload = (await imagePromptResponse.json()) as ImagePromptResponse;
      const finalPrompt = (imagePromptPayload.final_prompt || '').trim();
      if (!finalPrompt) {
        throw new Error(
          sanitizeErrorMessage(
            imagePromptPayload.detail || imagePromptPayload.error || '',
            'Image prompt generation returned empty output.',
          ),
        );
      }

      setLoadingStage('Generating (2/2)...');
      const referenceImages = await resolveBrandReferenceDataUrls(selectedBrand);
      const generationResponse = await fetch(IMAGE_GENERATION_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          image_input: referenceImages,
          brand: selectedBrand,
          user_request: userRequest,
        }),
        signal: controller.signal,
      });

      if (!generationResponse.ok) {
        const errorText = await generationResponse.text();
        throw new Error(parseApiError(generationResponse.status, errorText));
      }

      const payload = (await generationResponse.json()) as ImageGenerationResponse;
      const imageUrl = typeof payload.image_url === 'string' ? payload.image_url : '';
      if (!imageUrl) {
        throw new Error(payload.detail || payload.error || 'No image URL returned by the generation service.');
      }

      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: 'Image generated successfully.',
          imageUrl,
          imageBrand: selectedBrand,
        },
      ]);
    } catch (error) {
      let errorMessage = 'Sorry, image generation failed. Please try again.';
      if (error instanceof Error && error.name === 'AbortError') {
        errorMessage = 'Image generation timed out. Please try again.';
      } else if (error instanceof TypeError) {
        errorMessage =
          `Image generation service is not reachable (${IMAGE_PROMPT_API_URL}). Check HelioGram backend and CORS settings.`;
      } else if (error instanceof Error && error.message) {
        errorMessage = sanitizeErrorMessage(error.message, errorMessage);
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
              <h1 className="text-2xl font-bold text-neutral-900">Image Generator Agent</h1>
              <p className="text-sm text-neutral-500 mt-1">
                Subject-first two-step pipeline with clean prompt drafting before rendering.
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
                      <ImageIcon className="size-12 text-neutral-300" />
                      <p>Describe your image idea to generate the first result.</p>
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
                          className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-neutral-900 text-white rounded-tr-sm'
                              : 'bg-neutral-100 text-neutral-800 rounded-tl-sm'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                          {msg.imageUrl && (
                            <div className="mt-4 space-y-3">
                              <a href={msg.imageUrl} target="_blank" rel="noreferrer" className="block">
                                <div className="w-full aspect-video rounded-xl border border-neutral-200 bg-white overflow-hidden">
                                  <img
                                    src={msg.imageUrl}
                                    alt="Generated output"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDownload(msg.imageUrl ?? '', msg.imageBrand ?? selectedBrand)}
                                className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-yellow-400 hover:text-neutral-900 transition-colors"
                              >
                                <Download className="size-3.5" />
                                Download Image
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
                      placeholder="Describe the image you want..."
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
