import React, { useState } from 'react';
import {
  Play,
  X,
  Video,
  Image as ImageIcon,
  MessageSquare,
  Briefcase,
  Megaphone,
  PenTool,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';

const agents = [
  {
    icon: PenTool,
    title: "Detail Design",
    short: "An intelligent agent for generating detailed design specifications and creative assets.",
    long: "An intelligent agent dedicated to generating detailed design specifications, creative assets, and visual blueprints. It ensures that every design element aligns perfectly with your brand's core identity and visual guidelines.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4"
  },
  {
    icon: Briefcase,
    title: "Field Sales Ops Management",
    short: "A comprehensive system for managing field sales operations efficiently.",
    long: "A comprehensive system designed for managing field sales operations (سیستم مدیریت عملیات فروش میدانی). It optimizes routes, tracks performance, and provides real-time insights to empower your field sales team and maximize revenue.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4"
  },
  {
    icon: ImageIcon,
    title: "Image Generator",
    short: "Connected to Brain: Generate brand-aligned images instantly.",
    long: "Connected directly to the Brand Integrator Brain, this Image Generator creates high-quality, brand-aligned visual assets instantly. It understands your brand's visual language to produce consistent imagery for all channels.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    route: "/image-generator"
  },
  {
    icon: Video,
    title: "Video Generator",
    short: "Connected to Brain: Produce engaging video content automatically.",
    long: "Connected to the Brand Integrator Brain, the Video Generator automates the production of engaging video content. It scales your video marketing efforts while maintaining strict adherence to your brand's tone and style.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    route: "/video-generator"
  },
  {
    icon: Megaphone,
    title: "Campaign Maker",
    short: "Connected to Brain: Design and launch marketing campaigns seamlessly.",
    long: "Connected to the Brand Integrator Brain, the Campaign Maker designs, structures, and launches comprehensive marketing campaigns. It aligns messaging, targeting, and creative assets to maximize campaign ROI.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    route: "/campaign-maker"
  },
  {
    icon: MessageSquare,
    title: "Private Chatbot",
    short: "A secure, intelligent chatbot tailored to your specific business needs.",
    long: "A secure, intelligent private chatbot tailored to your specific business needs. It handles customer inquiries, provides internal support, and acts as a 24/7 representative that perfectly embodies your brand's voice.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4"
  }
];

export default function AgentStoreApp() {
  const navigate = useNavigate();
  const [activeAgent, setActiveAgent] = useState<typeof agents[0] | null>(null);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-yellow-400 selection:text-neutral-900">
      <SiteHeader />

      <main>
        <section id="agents" className="bg-neutral-50 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl mb-4">Agent Store</h2>
              <p className="text-lg text-neutral-600">Discover powerful AI agents to automate and elevate your business operations</p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((item, i) => (
                <div
                  key={i}
                  onClick={() => (item.route ? navigate(item.route) : setActiveAgent(item))}
                  className="group relative bg-white rounded-2xl p-8 shadow-sm border border-neutral-200 hover:shadow-lg hover:border-yellow-400/50 transition-all duration-300 flex flex-col cursor-pointer"
                >
                  <div className="mb-6 w-full aspect-video rounded-xl bg-neutral-100 overflow-hidden relative">
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
                  <h3 className="mb-3 text-xl font-semibold text-neutral-900">{item.title}</h3>
                  <p className="mb-6 text-neutral-600 leading-relaxed text-sm">{item.short}</p>
                  <div className="mt-auto pt-6 border-t border-neutral-100 flex items-center gap-2 text-yellow-600 font-medium text-sm group-hover:text-yellow-500 transition-colors">
                    {item.route ? <ArrowRight className="size-4" /> : <Play className="size-4" />}
                    <span>{item.route ? 'Open Agent' : 'Watch Video'}</span>
                  </div>
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-neutral-900/0 group-hover:ring-neutral-900/5 transition-all pointer-events-none"></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      {/* Video Modal */}
      {activeAgent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm" onClick={() => setActiveAgent(null)}></div>
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h3 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
                <activeAgent.icon className="size-5 text-yellow-500" />
                {activeAgent.title}
              </h3>
              <button onClick={() => setActiveAgent(null)} className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="aspect-video bg-neutral-900 rounded-xl overflow-hidden mb-6 relative">
                <video 
                  src={activeAgent.videoUrl} 
                  controls 
                  autoPlay 
                  className="w-full h-full object-cover"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <p className="text-neutral-700 leading-relaxed">
                {activeAgent.long}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
