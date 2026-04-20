import React, { useEffect, useRef, useState } from 'react';
import { Bot, Download, Send, Shield, User } from 'lucide-react';
import { SiteHeader } from '../../../shared/layout/SiteHeader';
import { SiteFooter } from '../../../shared/layout/SiteFooter';
import { useAuth } from '../../auth/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentBackendChatDefinition {
  title: string;
  subtitle: string;
  introMessage: string;
  endpointUrl: string;
  options: readonly string[];
  optionLabel: string;
  payloadOptionField: string;
  replyField?: string;
  serviceHint?: string;
}

interface AgentBackendChatPageProps {
  definition: AgentBackendChatDefinition;
  allowDownload?: boolean;
}

const parseBackendError = (status: number, bodyText: string): string => {
  const fallback = `Service failed with status ${status}.`;
  const trimmed = (bodyText || '').trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed?.detail || parsed?.error || parsed?.message || fallback;
  } catch {
    return trimmed.length > 400 ? fallback : trimmed;
  }
};

export function AgentBackendChatPage({
  definition,
  allowDownload = true,
}: AgentBackendChatPageProps) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [selectedOption, setSelectedOption] = useState<string>(definition.options[0] ?? '');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const replyField = definition.replyField ?? 'reply';

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
    if (!isAuthenticated) return;
    setMessages((prev) => (prev.length > 0 ? prev : [{ role: 'assistant', content: definition.introMessage }]));
  }, [isAuthenticated, definition.introMessage]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    const nextMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(nextMessages);

    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const payload: Record<string, unknown> = {
        [definition.payloadOptionField]: selectedOption,
        messages: nextMessages.map((msg) => ({ role: msg.role, content: msg.content })),
      };
      const response = await fetch(definition.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(parseBackendError(response.status, errorText));
      }

      const data = await response.json();
      const reply =
        typeof data?.[replyField] === 'string' && (data[replyField] as string).trim()
          ? (data[replyField] as string)
          : `No response from ${definition.title}.`;
      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
    } catch (error: unknown) {
      let errorMessage = 'Sorry, there was an error processing your request. Please try again later.';
      if (error instanceof Error && error.name === 'AbortError') {
        errorMessage = 'The request timed out. Please try again in a moment.';
      } else if (error instanceof TypeError) {
        errorMessage = `${definition.title} is not reachable (${definition.endpointUrl}). ${
          definition.serviceHint ?? 'Make sure the agent backend is running.'
        }`;
      } else if (error instanceof Error && error.message) {
        errorMessage = error.message;
      }
      setMessages([...nextMessages, { role: 'assistant', content: errorMessage }]);
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
        <p><strong>${definition.optionLabel}:</strong> ${selectedOption}</p>
    `;

    messages.forEach((msg) => {
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

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
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
                    {definition.optionLabel}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {definition.options.map((option) => {
                      const isActive = selectedOption === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSelectedOption(option)}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                            isActive
                              ? 'bg-yellow-400 border-yellow-400 text-neutral-900'
                              : 'bg-white border-neutral-200 text-neutral-600 hover:border-yellow-400 hover:text-neutral-900'
                          }`}
                        >
                          {option}
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
