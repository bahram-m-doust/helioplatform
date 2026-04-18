import React, { useEffect, useRef, useState } from 'react';
import { Bot, Download, Send, Shield, User } from 'lucide-react';
import { SiteHeader } from '../layout/SiteHeader';
import { SiteFooter } from '../layout/SiteFooter';
import { useAuth } from '../../context/AuthContext';
import {
  OPENROUTER_API_KEY,
  OPENROUTER_CHAT_URL,
  OPENROUTER_FALLBACK_MODELS,
  OPENROUTER_MODEL,
} from '../../config/site';

type BrandKey = 'Mansory' | 'Technogym' | 'Binghatti';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentDefinition {
  title: string;
  subtitle: string;
  introMessage: string;
  brandPrompts: Record<BrandKey, string>;
}

interface BrandedGeneratorAgentPageProps {
  definition: AgentDefinition;
  allowDownload?: boolean;
}

const BRAND_OPTIONS: BrandKey[] = ['Mansory', 'Technogym', 'Binghatti'];

const parseProviderError = (status: number, errorText: string): string => {
  let providerMessage = `API request failed with status ${status}.`;

  try {
    const parsedError = JSON.parse(errorText);
    providerMessage =
      parsedError?.error?.metadata?.raw ||
      parsedError?.error?.message ||
      parsedError?.message ||
      providerMessage;
  } catch {
    if (errorText.trim()) {
      providerMessage = errorText;
    }
  }

  return providerMessage;
};

const extractAssistantContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts = content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .filter(Boolean);

    if (textParts.length > 0) {
      return textParts.join('\n').trim();
    }
  }

  return 'No response from model.';
};

export function BrandedGeneratorAgentPage({
  definition,
  allowDownload = true,
}: BrandedGeneratorAgentPageProps) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [selectedBrand, setSelectedBrand] = useState<BrandKey>('Mansory');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    setMessages((prev) => {
      if (prev.length > 0) {
        return prev;
      }

      return [{ role: 'assistant', content: definition.introMessage }];
    });
  }, [definition.introMessage, isAuthenticated]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    if (!OPENROUTER_API_KEY) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Configuration error: missing VITE_OPENROUTER_API_KEY. Add it to your .env file and restart the app.',
        },
      ]);
      return;
    }

    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const modelsToTry = [OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS];
      const lastModel = modelsToTry[modelsToTry.length - 1];

      for (const modelId of modelsToTry) {
        const response = await fetch(OPENROUTER_CHAT_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-OpenRouter-Title': 'Helio Brand Strategy',
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: 'system', content: definition.brandPrompts[selectedBrand] },
              ...newMessages
                .filter((msg) => msg.role !== 'system')
                .map((msg) => ({ role: msg.role, content: msg.content })),
            ],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          const providerMessage = parseProviderError(response.status, errorText);
          const canTryFallback =
            modelId !== lastModel &&
            response.status === 429 &&
            /(rate-limit|rate limited|temporarily rate-limited|upstream|no healthy upstream)/i.test(
              providerMessage,
            );

          if (canTryFallback) {
            continue;
          }

          throw new Error(providerMessage);
        }

        const data = await response.json();
        const assistantMessage = extractAssistantContent(data?.choices?.[0]?.message?.content);
        setMessages([...newMessages, { role: 'assistant', content: assistantMessage }]);
        return;
      }

      throw new Error('No model returned a response. Please try again shortly.');
    } catch (error: unknown) {
      let errorMessage = 'Sorry, there was an error processing your request. Please try again later.';
      if (error instanceof Error && error.name === 'AbortError') {
        errorMessage = 'The request timed out. The model might be overloaded right now.';
      } else if (error instanceof Error && error.message) {
        errorMessage = error.message;
      }
      setMessages([...newMessages, { role: 'assistant', content: errorMessage }]);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (messages.length === 0) return;

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${definition.title} Chat History</title></head>
      <body>
        <h1>${definition.title} Chat History</h1>
        <p><strong>Selected Brand Profile:</strong> ${selectedBrand}</p>
    `;

    messages.forEach((msg) => {
      if (msg.role === 'system') return;
      const roleName = msg.role === 'user' ? 'You' : definition.title;
      const color = msg.role === 'user' ? '#2563eb' : '#16a34a';
      htmlContent += `
        <p style="color: ${color}; font-weight: bold;">${roleName}:</p>
        <p style="margin-bottom: 20px; white-space: pre-wrap;">${msg.content
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</p>
      `;
    });

    htmlContent += `</body></html>`;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${definition.title.replace(/\s+/g, '_')}_Chat.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-yellow-400 selection:text-neutral-900 flex flex-col">
      <SiteHeader isAuthenticated={isAuthenticated} onLoginClick={openAuthModal} />

      <main className="flex-1 bg-neutral-50 py-8 sm:py-12 flex flex-col">
        <div className="mx-auto w-full max-w-4xl px-6 lg:px-8 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">{definition.title}</h1>
              <p className="text-sm text-neutral-500 mt-1">{definition.subtitle}</p>
            </div>
            {allowDownload && isAuthenticated && messages.length > 0 && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 px-4 py-2 rounded-md shadow-sm transition-colors"
              >
                <Download className="size-4" />
                Download Chat
              </button>
            )}
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
                  <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase mb-3">
                    Select Brand
                  </p>
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
                      <Bot className="size-12 text-neutral-300" />
                      <p>Start a conversation with {definition.title}</p>
                    </div>
                  ) : (
                    messages
                      .filter((msg) => msg.role !== 'system')
                      .map((msg, idx) => (
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
                            className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                              msg.role === 'user'
                                ? 'bg-neutral-900 text-white rounded-tr-sm'
                                : 'bg-neutral-100 text-neutral-800 rounded-tl-sm'
                            }`}
                          >
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </div>
                        </div>
                      ))
                  )}
                  {isLoading && (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 text-yellow-400 border border-neutral-200 flex items-center justify-center shrink-0">
                        <Bot className="size-4" />
                      </div>
                      <div className="bg-neutral-100 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-1">
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0.4s' }}
                        ></div>
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
                      placeholder="Type your message..."
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
                    Press Enter to send, Shift+Enter for new line
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
