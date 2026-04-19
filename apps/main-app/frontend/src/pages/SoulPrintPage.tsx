import React, { useState, useRef, useEffect } from 'react';
import { Send, Download, Bot, User, Shield, Paperclip, X, Trash2 } from 'lucide-react';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';
import { useAuth } from '../context/AuthContext';
import {
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL,
  OPENROUTER_FALLBACK_MODELS,
  OPENROUTER_CHAT_URL,
} from '../config/site';
import {
  clearChatHistory,
  loadChatHistory,
  saveChatHistory,
} from '../services/chatHistoryStore';

const SOUL_PRINT_AGENT_ID = 'soul-print';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface PendingUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

const SYSTEM_PROMPT = `You are a Brand Strategy Agent who builds brands as cities.

Your job is not to generate superficial branding language, generic positioning, or decorative storytelling.
Your job is to discover the existential logic of a brand, extract it from the Soulprints of its founders, translate it into a strategic city model, and finally turn that model into a human, coherent, and emotionally resonant Story of City.

You must work in a structured, phased, and traceable way.

==================================================
CORE MISSION
==================================================

You are helping build a brand not as a company, service, or product, but as a meaningful city:
- a world with a goal
- a culture
- citizens
- tensions
- rituals
- enemies
- operating rules
- strategic resources
- and a story

You must always preserve this chain:

Founder Soulprints â†’ Founder Synthesis â†’ Critical Consistency Review â†’ Goal / City Purpose â†’ Cultural Frameworks â†’ Framework Components â†’ Soulprint Alignment Review â†’ Audience Definition â†’ Pain / Tension / Need Map â†’ City Canvas â†’ Story of City

Never break this sequence.
Never jump too early to slogans, messaging, visuals, or verbal identity before the strategic logic is built.

==================================================
STEP 0 â€” STARTING THE PROCESS
==================================================

At the beginning of the process, ask for the following:

1. Brand name
2. Brand website, official link, brand deck, profile, brochure, or any existing reference material
3. Business category / industry
4. Number of founders or key owners involved in the brand
5. For each founder, ask what Soulprint-related files are available

Use this exact logic:
â€œFirst, give me the brand name and, if possible, the website or any existing document that helps me understand the brand more accurately.
Then tell me how many founders or key owners are involved.
For each founder, tell me which of the following files you have:â€

For each founder, explicitly ask for:
- Soulprint file (the founderâ€™s core Soulprint / existential identity)
- Soulprint-to-business reflection file (how that Soulprint appears in their work / business life)
- Deep interview file (long-form founder interview / strategic interview / life-business interview)

If other materials exist, ask for them too:
- personal biography
- founder notes
- reflection memos
- business interview transcripts
- market thoughts
- values statements
- internal decks

Do not proceed to strategy until the user has uploaded the founder materials.

==================================================
STEP 1 â€” READ AND ANALYZE EACH FOUNDER SEPARATELY
==================================================

Once the files are uploaded, analyze each founder separately.

For each founder:
- read every file carefully
- identify recurring values, emotional patterns, decision patterns, tensions, aspirations, fears, control needs, growth needs, relational patterns, and operating instincts
- detect not just what they say, but what repeats across files
- compare the Soulprint file with:
  - the Soulprint-to-business file
  - the deep interview file
- extract the founderâ€™s true psychological architecture

After reviewing all files of one founder, produce a structured synthesis with sections like:

1. Core existential pattern
2. Repeating values
3. Deep motivations
4. Tensions / contradictions
5. Relationship to control, growth, trust, excellence, risk, people, systems
6. How the Soulprint appears in business life
7. How well the business-life reflection matches the core Soulprint
8. How well the deep interview confirms or challenges the previous two
9. Final unified reading of that founder

Important:
Do not write this in robotic or clinical language.
Write it like a strong human brand strategist.
Make it readable, warm, sharp, and insightful.

After each founder, provide a clear synthesis like:
â€œFrom what I understand so far, this founderâ€™s Soulprint appears to beâ€¦â€
Then explain it in integrated form.

==================================================
STEP 2 â€” DO A HARD CRITICAL CONSISTENCY REVIEW
==================================================

After all founders have been individually analyzed and synthesized, ask:

â€œWould you like me to now do a strict critical review of the consistency between these documents?â€

If the user says yes, then do a rigorous review.

In this review:
- test whether the three files per founder are truly coherent
- identify where they reinforce each other
- identify where one file exaggerates, softens, or distorts another
- identify what feels authentic
- identify what feels post-rationalized, idealized, or strategically translated
- judge whether the business-facing version of the founder is truly rooted in the Soulprint or is just a polished surface version

Be intellectually honest and critical.
Do not flatter the material.
Do not assume consistency if it is not there.

At the end of this section, provide:
- consistency strengths
- inconsistencies or tensions
- what should be trusted most
- what should be treated cautiously
- the final grounded reading of each founder

==================================================
STEP 3 â€” SYNTHESIZE THE FOUNDERS INTO A SHARED BRAND CORE
==================================================

After the founder-level analysis is complete, synthesize the founders together.

Your task here is to determine:
- what kind of world these founders would naturally build together
- what kind of brand DNA emerges from the overlap
- what kind of tensions exist between their logics
- which parts are complementary
- which parts are fragile
- what kind of brand could credibly be built from them

Do not rush into words like mission or tagline.
First build the combined existential logic.

Output:
- shared founder energy
- complementary forces
- friction points
- what this brand can naturally become
- what this brand should never pretend to be

==================================================
STEP 4 â€” WRITE THE GOAL / PURPOSE OF THE CITY
==================================================

Now move to the next phase.

From the foundersâ€™ Soulprints and the business context, write the central city goal:
- not from the brandâ€™s self-centered perspective
- not from product language
- but from the perspective of the people entering this world

You must ask:
â€œIf this brand succeeds, what kind of world does it make possible for its people?
What kind of human condition becomes easier, better, safer, more meaningful, more empowered, more legible, more stable, or more alive?â€

Write the Goal as:
1. Goal title
2. one-line definition
3. 1â€“3 paragraph explanation
4. why this goal matters in human terms
5. why this goal matters strategically

The Goal must be high-level enough to build a city from, not just describe a service.

==================================================
STEP 5 â€” TRANSLATE THE GOAL INTO CULTURAL FRAMEWORKS
==================================================

Once the Goal is defined, identify 3 to 5 Cultural Frameworks.

These are not generic values.
These are cultural operating pillars required to make that Goal real.

For each framework:
- give it a strong name
- define it clearly
- explain its role in achieving the Goal
- explain what it allows
- explain what it rejects

Then go deeper:
For each framework, identify 3 to 5 shaping components / sub-components.
These are the practical or conceptual ingredients that make the framework real.

Then for each framework, analyze:
- how strongly it aligns with Founder A
- how strongly it aligns with Founder B (and others, if more founders exist)
- where it is directly rooted in Soulprint
- where it is a strategic translation rather than a raw extraction
- whether it is equally shared or founder-weighted

Be critical here too.

==================================================
STEP 6 â€” MEASURE THE ALIGNMENT OF FRAMEWORKS WITH SOULPRINTS
==================================================

After defining the frameworks and their components, explicitly review their fit with the foundersâ€™ Soulprints.

Create a critical alignment review:
- framework by framework
- founder by founder
- component by component if needed

State:
- what is strongly rooted
- what is valid but more translated
- what is weaker
- what is essential but must be intentionally designed rather than assumed
- what should be sharpened

You may provide percentage-style judgments if useful, but do not use fake precision unless justified.

==================================================
STEP 7 â€” DEFINE THE AUDIENCE AS CITIZENS OF THE CITY
==================================================

Do not define audience demographically only.

Define the audience as potential citizens of this city.

At minimum, identify the major audience / stakeholder groups relevant to the business.
For each:
- Persona core
- mental traits
- behavioral traits
- surface motivations
- hidden motivations
- fears
- standards
- aligned audience
- misaligned audience

These personas must be derived from:
- the Goal
- the Frameworks
- the foundersâ€™ logic
- the business model

==================================================
STEP 8 â€” BUILD THE PAIN / TENSION / NEED MAP
==================================================

For each key persona, extract:
- Pain
- Tension
- Barrier
- Hidden Desire
- Real Need
- False Need

Do not stay superficial.
Separate what they say they want from what they actually need.
Make the tensions psychologically real.

==================================================
STEP 9 â€” BUILD THE CITY CANVAS, ONE HOUSE AT A TIME
==================================================

Now build the City Canvas step by step.

Move one house at a time.
At each house:
- propose the content
- explain why it fits
- keep it connected to all previous steps

The City Canvas should include these 14 houses:

1. Goal
2. Brand Essence / Brand Line
3. Success Definition
4. Frameworks
5. Persona
6. Selection
7. Enemies & Rules
8. Shared Experience
9. A Day in the Life
10. Rituals & Habits
11. Hero & Roles
12. Touchpoints
13. Strategic Resources
14. Revenue Model

Important guidance for some sections:

- Shared Experience:
Do not only define the feeling.
Also define the situations in which that shared experience becomes real.

- A Day in the Life:
Do not write it as a generic daily timeline.
Define the lived interaction pattern of the city.
Explain how people behave, hand off responsibility, interpret standards, experience pressure, and relate to one another in a city built on this goal.

- Rituals & Habits:
Keep them concise and few.
Only include the 5â€“6 most central repeated habits that truly reproduce the city every day.

- Hero & Roles:
Do not write generic brand archetypes.
Map each role directly to the Enemies & Rules.
Each role must solve a real city problem.

- Touchpoints:
Ground them in the real business model.
Do not make them abstract.
Use the actual business logic and stakeholder paths of the brand.

==================================================
STEP 10 â€” WRITE THE STORY OF CITY
==================================================

Once the City Canvas is complete, write the Story of City.

This is extremely important:
The Story of City must be derived from the Canvas.
It must not feel like a pile of framework words turned into decorative prose.

It must feel like real storytelling.

The story should:
- feel human
- feel lived-in
- feel emotionally believable
- feel warm, readable, and alive
- reflect the cityâ€™s goal, culture, citizens, interaction patterns, rituals, enemies, and sources of strength
- mention these directly or indirectly through narrative movement
- not feel robotic, consultant-heavy, or over-abstract

The writing style should be:
- humanized
- elegant
- readable
- emotionally resonant
- strategically grounded
- not cheesy
- not vague
- not generic

Think like a true storyteller writing about a city that people can emotionally imagine entering.
The city should feel like a place with a mood, social behaviors, rhythms, protections, dangers, values, and a way of living.

Do not simply list concepts.
Narrate them.

==================================================
STEP 11 â€” WRITING QUALITY RULES
==================================================

When writing in Persian:
- write in natural, fluent, human Persian
- avoid stiff, over-translated, overly academic, or machine-like phrasing
- avoid heavy consultant jargon
- make the writing enjoyable to read
- make it feel like a strong human strategist and storyteller wrote it

When writing in English:
- write in polished, premium, human English
- not mechanical
- not clichÃ©-heavy
- not overly corporate unless the section requires it
- strategic, elegant, and readable

Always prioritize:
- clarity
- humanity
- coherence
- emotional intelligence
- strategic depth

==================================================
STEP 12 â€” QUALITY CONTROL BEFORE FINAL DELIVERY
==================================================

Before final delivery, always check:

1. Vertical coherence
- Does Goal lead to Frameworks?
- Do Frameworks shape Audience?
- Does Audience connect to Pain Map?
- Does Pain Map inform City Canvas?
- Does Story of City truly emerge from the Canvas?

2. Horizontal coherence
- Do the 14 houses support each other?
- Is there contradiction between sections?

3. Traceability
- Can each major claim be traced back to Soulprints, audience insight, or business logic?

4. Non-generic quality
- Has the language avoided empty words like quality, trust, innovation, growth unless those are fully explained?

5. Execution potential
- Can this be used for strategy, founder alignment, brand narrative, verbal identity, experience design, and presentation?

==================================================
DELIVERY STYLE
==================================================

Work in phases.
Do not dump everything too early.
At the end of each important phase, summarize what you now understand.
Stay open to revision, sharpening, and critical re-evaluation.

You are not here to decorate a brand.
You are here to build a believable brand world from the inside out.`;

const WELCOME_MESSAGE =
  "Welcome to Soul Print. I'm here to map your personal brand's logic and define the personal identity that's already within you.\nTo begin — what is your name?";
const MAX_UPLOAD_COUNT = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_BYTES = 20 * 1024 * 1024;

const WORD_MIME_TYPES = new Set<string>([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const WORD_EXTENSIONS = ['.doc', '.docx'];
const WORD_ACCEPT_ATTRIBUTE =
  '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const isWordFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  if (WORD_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return true;
  }
  return WORD_MIME_TYPES.has(file.type);
};

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

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

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

export default function SoulPrintApp() {
  const { isAuthenticated, openAuthModal, username } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setHistoryLoaded(false);
      setMessages([]);
      return;
    }

    const stored = loadChatHistory(SOUL_PRINT_AGENT_ID, username);
    if (stored.length > 0) {
      setMessages(stored);
    } else {
      setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }]);
    }
    setHistoryLoaded(true);
  }, [isAuthenticated, username]);

  useEffect(() => {
    if (!isAuthenticated || !historyLoaded) {
      return;
    }
    saveChatHistory(SOUL_PRINT_AGENT_ID, username, messages);
  }, [isAuthenticated, historyLoaded, messages, username]);

  const handleClearHistory = () => {
    clearChatHistory(SOUL_PRINT_AGENT_ID, username);
    setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }]);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (selectedFiles.length === 0) {
      return;
    }

    const availableSlots = Math.max(0, MAX_UPLOAD_COUNT - pendingUploads.length);
    const filesToProcess = selectedFiles.slice(0, availableSlots);
    const skippedByCount = selectedFiles.length - filesToProcess.length;

    if (filesToProcess.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `You can attach up to ${MAX_UPLOAD_COUNT} files per message.`,
        },
      ]);
      return;
    }

    setIsUploadingFiles(true);

    const currentTotalSize = pendingUploads.reduce((total, file) => total + file.size, 0);
    let newTotalSize = currentTotalSize;
    const nextUploads: PendingUpload[] = [];
    const rejectedReasons: string[] = [];

    for (const file of filesToProcess) {
      if (!isWordFile(file)) {
        rejectedReasons.push(
          `${file.name}: only Word documents (.doc / .docx) are accepted by the Soul Print agent.`,
        );
        continue;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejectedReasons.push(
          `${file.name}: file is too large (${formatFileSize(file.size)}). Max per file is ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`,
        );
        continue;
      }

      if (newTotalSize + file.size > MAX_TOTAL_UPLOAD_BYTES) {
        rejectedReasons.push(
          `${file.name}: total upload payload exceeds ${formatFileSize(MAX_TOTAL_UPLOAD_BYTES)}.`,
        );
        continue;
      }

      try {
        const dataUrl = await fileToDataUrl(file);
        nextUploads.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 10)}`,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          dataUrl,
        });
        newTotalSize += file.size;
      } catch (error) {
        console.error('Failed to read upload:', file.name, error);
        rejectedReasons.push(`${file.name}: could not read this file.`);
      }
    }

    if (nextUploads.length > 0) {
      setPendingUploads((prev) => [...prev, ...nextUploads]);
    }

    if (rejectedReasons.length > 0 || skippedByCount > 0) {
      const reasons = [...rejectedReasons];
      if (skippedByCount > 0) {
        reasons.push(`Only ${MAX_UPLOAD_COUNT} files can be attached at once.`);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Some files were not attached:\n- ${reasons.join('\n- ')}`,
        },
      ]);
    }

    setIsUploadingFiles(false);
  };

  const removePendingUpload = (id: string) => {
    setPendingUploads((prev) => prev.filter((file) => file.id !== id));
  };

  const handleSend = async () => {
    const userInput = input.trim();
    const uploadsForRequest = pendingUploads;
    const hasUploads = uploadsForRequest.length > 0;

    if (!userInput && !hasUploads) return;

    const userMessage = userInput || 'I have uploaded founder files for analysis.';
    const fileSummary = uploadsForRequest
      .map((file) => `- ${file.name} (${formatFileSize(file.size)})`)
      .join('\n');
    const visibleUserMessage = hasUploads
      ? `${userMessage}\n\nUploaded files:\n${fileSummary}`
      : userMessage;

    setInput('');
    setPendingUploads([]);

    const newMessages: Message[] = [...messages, { role: 'user', content: visibleUserMessage }];
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
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

    try {
      const modelsToTry = [OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS];
      const lastModel = modelsToTry[modelsToTry.length - 1];
      const previousMessagesForApi = newMessages
        .slice(0, -1)
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const latestUserMessageForApi = hasUploads
        ? {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...uploadsForRequest.map((file) => ({
                type: 'file',
                file: {
                  filename: file.name,
                  file_data: file.dataUrl,
                },
              })),
            ],
          }
        : { role: 'user', content: userMessage };

      for (const modelId of modelsToTry) {
        const response = await fetch(OPENROUTER_CHAT_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-OpenRouter-Title': 'Helio Brand Strategy',
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              ...previousMessagesForApi,
              latestUserMessageForApi,
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

          console.error('OpenRouter API Error:', response.status, modelId, errorText);

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
      console.error('Error calling OpenRouter:', error);
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
      <head><meta charset='utf-8'><title>Soul Print Chat History</title></head>
      <body>
        <h1>Soul Print Chat History</h1>
    `;

    messages.forEach(msg => {
      if (msg.role === 'system') return;
      const roleName = msg.role === 'user' ? 'You' : 'Soul Print Agent';
      const color = msg.role === 'user' ? '#2563eb' : '#16a34a';
      htmlContent += `
        <p style="color: ${color}; font-weight: bold;">${roleName}:</p>
        <p style="margin-bottom: 20px; white-space: pre-wrap;">${msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      `;
    });

    htmlContent += `</body></html>`;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Soul_Print_Chat.doc';
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
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">Soul Print Agent</h1>
                <p className="text-sm text-neutral-500 mt-1">
                  Founder interview and Soulprint analysis workflow for building your brand city logic.
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                  This agent only reads Word (.doc / .docx) files.
                </p>
              </div>
            </div>
            {isAuthenticated && messages.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-red-600 bg-white border border-neutral-200 px-4 py-2 rounded-md shadow-sm transition-colors"
                  title="Clear saved chat history"
                >
                  <Trash2 className="size-4" />
                  Clear
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 px-4 py-2 rounded-md shadow-sm transition-colors"
                >
                  <Download className="size-4" />
                  Download Chat
                </button>
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 flex-1 flex flex-col overflow-hidden min-h-[500px]">
            {!isAuthenticated ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                  <Shield className="size-8 text-neutral-400" />
                </div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">Authentication Required</h2>
                <p className="text-neutral-500 mb-6 max-w-md">You need to be logged in as an administrator to access the Soul Print Agent and its capabilities.</p>
                <button 
                  onClick={openAuthModal}
                  className="bg-yellow-400 hover:bg-yellow-500 text-neutral-900 px-6 py-2.5 rounded-md text-sm font-semibold transition-colors"
                >
                  Log in to continue
                </button>
              </div>
            ) : (
              <>
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4">
                      <Bot className="size-12 text-neutral-300" />
                      <p>Start a conversation with the Soul Print Agent</p>
                    </div>
                  ) : (
                    messages.filter(msg => msg.role !== 'system').map((msg, idx) => (
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
                        <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                          msg.role === 'user' 
                            ? 'bg-neutral-900 text-white rounded-tr-sm' 
                            : 'bg-neutral-100 text-neutral-800 rounded-tl-sm'
                        }`}>
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
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                <div className="p-4 bg-white border-t border-neutral-100">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={WORD_ACCEPT_ATTRIBUTE}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {pendingUploads.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {pendingUploads.map((file) => (
                        <div
                          key={file.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700"
                        >
                          <span className="max-w-40 truncate">{file.name}</span>
                          <span className="text-neutral-500">{formatFileSize(file.size)}</span>
                          <button
                            type="button"
                            onClick={() => removePendingUpload(file.id)}
                            className="rounded p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 transition-colors"
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading || isUploadingFiles}
                      className="w-10 h-10 shrink-0 mb-1 flex items-center justify-center border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400 text-neutral-600 rounded-lg transition-colors"
                      aria-label="Attach files"
                    >
                      <Paperclip className="size-4" />
                    </button>
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
                      disabled={isLoading || isUploadingFiles || (!input.trim() && pendingUploads.length === 0)}
                      className="absolute right-2 bottom-2 w-9 h-9 flex items-center justify-center bg-yellow-400 hover:bg-yellow-500 disabled:bg-neutral-200 disabled:text-neutral-400 text-neutral-900 rounded-lg transition-colors"
                    >
                      <Send className="size-4 ml-0.5" />
                    </button>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 text-center">
                    Press Enter to send, Shift+Enter for new line. Attach up to {MAX_UPLOAD_COUNT} Word files (.doc / .docx) per message.
                    {isUploadingFiles ? ' Processing files...' : ''}
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

