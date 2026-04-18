import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Play,
  X,
  LayoutTemplate,
  Brain,
  Cpu,
  Fingerprint,
  UserCircle,
  Video,
} from 'lucide-react';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';

const services = [
  {
    icon: LayoutTemplate,
    title: "Brand City Canvas",
    short: "A set of strategic guidelines for designers and executives which enlightens Brand Identity and Culture to integrate brand messages.",
    long: "A comprehensive set of strategic guidelines crafted for designers and executives, aimed at illuminating and articulating the brand’s identity and culture in a clear, actionable way. It provides a shared framework for understanding the brand’s voice, values, visual language, and behavioral principles, ensuring that all creative and strategic decisions are aligned. By translating abstract brand concepts into practical direction, it enables teams to consistently integrate brand messages across products, communications, and experiences, fostering coherence, authenticity, and long-term brand equity.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4"
  },
  {
    icon: Brain,
    title: "Brand Integrator Brain",
    short: "An AI-powered Process Center which create integrity by codifying the Brand City Canvas and turn into brand’s digital twin with 91% accuracy in decision making and action planning.",
    long: "An AI-powered Process Center that establishes cohesion and operational integrity by codifying the Brand City Canvas into a structured, living system, effectively transforming it into the brand’s digital twin. By continuously learning from data, interactions, and strategic inputs, it mirrors the brand’s thinking, decision-making patterns, and behavioral logic, enabling consistent and scalable execution across all touchpoints. With 91% of accuracy in decision-making and action, it reduces fragmentation, aligns teams, and ensures that every output remains true to the brand’s core identity, strategy, and long-term objectives.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4"
  },
  {
    icon: Cpu,
    title: "Plug-in Agents",
    short: "Technology-based special tools, can automate business processes in variety of aspects, align with brand Identity.",
    long: "Technology-based specialized tools designed to automate and optimize a wide range of business processes, from operations and customer engagement to content production and internal workflows, all while staying aligned with the brand’s identity. These tools embed the brand’s voice, values, and strategic principles into everyday actions, ensuring consistency across outputs and interactions. By reducing manual effort and increasing efficiency, they enable scalable growth without compromising authenticity, allowing the brand to operate more intelligently, cohesively, and in harmony with its core identity.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4"
  },
  {
    icon: Fingerprint,
    title: "Soul Print",
    short: "An AI interviewer agent to make a personal profile analysis by deep conversations with brand founders to reach communions around brand values and goals.",
    long: "An AI interviewer agent designed to conduct in-depth, human-like conversations with brand founders, uncovering nuanced insights into their vision, motivations, and decision-making processes, in order to build a rich and multidimensional personal profile analysis. Through these deep conversations, it identifies shared meanings and aligns perspectives, helping to establish strong communions around core brand values, long-term goals, and the underlying narratives that shape the brand’s identity and future direction.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4"
  },
  {
    icon: UserCircle,
    title: "Avatar",
    short: "An AI generated digital persona as a brand asset, designed for direct interaction and user guidance. It acts as an official brand representative across touchpoints such as the website, DMs, kiosks, apps, or online support.",
    long: "An AI-generated digital persona developed as a strategic brand asset, purpose-built for seamless, real-time interaction and personalized user guidance across a wide range of customer journeys. It serves as an official, always-on brand representative, consistently embodying the brand’s voice, tone, and values while engaging users in meaningful, context-aware conversations. Deployed across key touchpoints such as websites, direct messages, physical kiosks, mobile applications, and online support channels, it enhances user experience, builds trust, and creates a cohesive, human-like interface between the brand and its audience.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4"
  },
  {
    icon: Video,
    title: "Content Factory",
    short: "Combination of human experts and AI agents and tools which create variety of stories align with brand values according to marketing goals such as social media post and campaigns, videos and teasers, and etc. it transforms scattered posts into structured series that retain attention and keep audiences coming back.",
    long: "A hybrid system that brings together human experts with AI agents and creative tools to produce a diverse range of stories aligned with a brand’s values and strategic marketing goals—spanning social media content, campaigns, videos, teasers, and more. By blending human insight with AI-driven scalability, it turns fragmented, one-off posts into cohesive, narrative-driven series that capture attention, build continuity, and keep audiences consistently engaged and returning for more.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4"
  }
];

export default function ServicesApp() {
  const [activeService, setActiveService] = useState<typeof services[0] | null>(null);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-yellow-400 selection:text-neutral-900">
      <SiteHeader />

      <main>
        <section id="services" className="bg-neutral-50 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl mb-4">Our Services</h2>
              <p className="text-lg text-neutral-600">Comprehensive solutions designed to help your business thrive in the digital age</p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {services.map((item, i) => (
                <div key={i} className="group relative bg-white rounded-2xl p-8 shadow-sm border border-neutral-200 hover:shadow-lg hover:border-yellow-400/50 transition-all duration-300 flex flex-col cursor-pointer">
                  <div 
                    className="mb-6 w-full aspect-video rounded-xl bg-neutral-100 overflow-hidden relative"
                    onClick={() => {
                      if (item.title === "Plug-in Agents") {
                        navigate("/agent-store");
                      } else {
                        setActiveService(item);
                      }
                    }}
                  >
                    <video 
                      src={item.videoUrl} 
                      className="w-full h-full object-cover"
                      preload="metadata"
                    />
                    <div className="absolute inset-0 bg-neutral-900/10 group-hover:bg-transparent transition-colors flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-sm text-yellow-600 group-hover:scale-110 transition-transform">
                        <Play className="size-4 ml-1" />
                      </div>
                    </div>
                  </div>
                  <div onClick={() => {
                    if (item.title === "Plug-in Agents") {
                      navigate("/agent-store");
                    } else if (item.title !== "Soul Print") {
                      setActiveService(item);
                    }
                  }}>
                    <h3 className="mb-3 text-xl font-semibold text-neutral-900">{item.title}</h3>
                    <p className="mb-6 text-neutral-600 leading-relaxed text-sm">{item.short}</p>
                  </div>
                  
                  {item.title === "Soul Print" ? (
                    <div className="mt-auto pt-6 border-t border-neutral-100">
                      <Link to="/soul-print" className="flex items-center justify-center w-full bg-yellow-400 hover:bg-yellow-500 text-neutral-900 font-semibold text-sm py-3 rounded-xl transition-colors relative z-10">
                        Try it out
                      </Link>
                    </div>
                  ) : (
                    <div 
                      className="mt-auto pt-6 border-t border-neutral-100 flex items-center gap-2 text-yellow-600 font-medium text-sm group-hover:text-yellow-500 transition-colors"
                      onClick={() => {
                        if (item.title === "Plug-in Agents") {
                          navigate("/agent-store");
                        } else {
                          setActiveService(item);
                        }
                      }}
                    >
                      <Play className="size-4" />
                      <span>Watch Video</span>
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-neutral-900/0 group-hover:ring-neutral-900/5 transition-all pointer-events-none"></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      {/* Video Modal */}
      {activeService && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm" onClick={() => setActiveService(null)}></div>
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h3 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
                <activeService.icon className="size-5 text-yellow-500" />
                {activeService.title}
              </h3>
              <button onClick={() => setActiveService(null)} className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="aspect-video bg-neutral-900 rounded-xl overflow-hidden mb-6 relative">
                <video 
                  src={activeService.videoUrl} 
                  controls 
                  autoPlay 
                  className="w-full h-full object-cover"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <p className="text-neutral-700 leading-relaxed">
                {activeService.long}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
