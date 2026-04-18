import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, ArrowRight, ChevronLeft, ChevronRight, LayoutTemplate, Maximize, TrendingUp, Settings } from 'lucide-react';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';
import { useAuth } from '../context/AuthContext';

const MansoryLogo = () => (
  <svg viewBox="0 0 400 80" className="h-6 sm:h-8 w-auto fill-current text-white" xmlns="http://www.w3.org/2000/svg">
    <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="butt">
      <line x1="10" y1="25" x2="70" y2="25" />
      <line x1="25" y1="40" x2="70" y2="40" />
      <line x1="40" y1="55" x2="70" y2="55" />
    </g>
    <text x="200" y="52" fontFamily="Times New Roman, serif" fontSize="42" textAnchor="middle" letterSpacing="0.1em" fill="currentColor">MANSORY</text>
    <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="butt">
      <line x1="330" y1="25" x2="390" y2="25" />
      <line x1="330" y1="40" x2="375" y2="40" />
      <line x1="330" y1="55" x2="360" y2="55" />
    </g>
  </svg>
);

const BinghattiLogo = () => (
  <svg viewBox="0 0 300 100" className="h-8 sm:h-10 w-auto fill-current text-white" xmlns="http://www.w3.org/2000/svg">
    <path d="M 20 25 L 60 25 C 80 25 80 45 60 45 L 35 45 L 55 45 C 85 45 85 75 55 75 L 10 75 L 20 25" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"/>
    <text x="110" y="45" fontFamily="Arial, sans-serif" fontSize="28" fontWeight="bold" fill="currentColor">بن غاطي</text>
    <text x="110" y="80" fontFamily="Times New Roman, serif" fontSize="30" fontWeight="bold" fill="currentColor" letterSpacing="0.05em">BINGHATTI</text>
  </svg>
);

const CaffinoLogo = () => (
  <svg viewBox="0 0 200 100" className="h-10 sm:h-12 w-auto fill-current text-white" xmlns="http://www.w3.org/2000/svg">
    <path id="curve" d="M 40 35 Q 100 15 160 35" fill="transparent" />
    <text fontSize="14" fontWeight="bold" fontFamily="Arial, sans-serif" fill="currentColor" letterSpacing="0.1em">
      <textPath href="#curve" startOffset="50%" textAnchor="middle">DELIZIO</textPath>
    </text>
    <text x="100" y="75" fontFamily="Impact, Arial Black, sans-serif" fontSize="48" fontWeight="bold" textAnchor="middle" fill="currentColor" letterSpacing="0.02em">CAFFINO</text>
    <text x="100" y="95" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" textAnchor="middle" fill="currentColor" letterSpacing="0.2em">EST. 2018</text>
    <path d="M 60 91 L 75 91 M 125 91 L 140 91" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const ArchLogo = () => (
  <svg viewBox="0 0 100 100" className="h-8 sm:h-10 w-auto fill-current text-white" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="currentColor" />
    <path d="M 30 75 L 30 50 A 20 20 0 0 1 70 50 L 70 75 L 55 75 L 55 50 A 5 5 0 0 0 45 50 L 45 75 Z" fill="#171717" />
  </svg>
);

export default function App() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-yellow-400 selection:text-neutral-900">
      <SiteHeader isAuthenticated={isAuthenticated} onLoginClick={openAuthModal} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                <span className="text-sm font-medium text-neutral-700">AI-Powered Brand Identity</span>
              </div>
              <h1 className="mb-6 text-5xl font-semibold tracking-tight text-neutral-900 sm:text-6xl lg:text-7xl">
                <span className="text-yellow-400">Integrate</span> Your Brand Identity Across Every Touchpoint
              </h1>
              <p className="mb-10 text-lg text-neutral-600 sm:text-xl">
                Helio uses artificial intelligence to ensure your brand identity stays consistent, flexible, and future-ready across all channels.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button className="bg-yellow-400 hover:bg-yellow-500 text-neutral-900 px-8 py-3 rounded-md text-base font-semibold transition-colors flex items-center gap-2 w-full sm:w-auto justify-center">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button className="border border-neutral-300 hover:bg-neutral-50 text-neutral-900 px-8 py-3 rounded-md text-base font-semibold transition-colors w-full sm:w-auto">
                  See Our Work
                </button>
              </div>
            </div>
          </div>
          <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl pointer-events-none" aria-hidden="true">
            <div className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-yellow-100 to-yellow-50 opacity-30"></div>
          </div>
        </section>

        {/* Video Placeholder */}
        <section className="px-6 lg:px-8 max-w-5xl mx-auto mb-20">
          <div className="relative rounded-2xl overflow-hidden bg-neutral-100 aspect-video shadow-xl border border-neutral-200 group">
            <img src="https://picsum.photos/seed/meeting/1920/1080" alt="Video thumbnail" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center transition-colors group-hover:bg-black/30">
              <button className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg">
                <Play className="w-6 h-6 text-neutral-900 fill-neutral-900 ml-1" />
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-4 text-white text-sm font-medium">
                <span>4:12</span>
                <div className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden">
                  <div className="w-1/2 h-full bg-yellow-400"></div>
                </div>
                <span>8:24</span>
              </div>
            </div>
          </div>
        </section>

        {/* Trusted Brands */}
        <section className="bg-neutral-900 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-center text-sm font-semibold tracking-wide text-neutral-400 uppercase mb-10">Trusted by leading brands</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-70">
              <BinghattiLogo />
              <ArchLogo />
              <CaffinoLogo />
              <MansoryLogo />
            </div>
          </div>
        </section>

        {/* Challenges */}
        <section className="bg-neutral-50 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl mb-4">What Holds Brands Back</h2>
              <p className="text-lg text-neutral-600">Inconsistent execution, rigid systems, and lack of insight make it difficult to scale and evolve your brand.</p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                { icon: LayoutTemplate, title: 'Brand Integrity', desc: 'Maintaining consistent brand identity across multiple platforms and touchpoints is challenging.', sub: 'Inconsistent messaging and visual identity damage brand trust and recognition.' },
                { icon: Maximize, title: 'Flexibility', desc: 'Adapting brand elements for different contexts without losing core identity is complex.', sub: 'Rigid brand guidelines fail to accommodate diverse marketing channels and formats.' },
                { icon: TrendingUp, title: 'Future Strategy', desc: 'Predicting and planning for evolving brand needs in dynamic markets is difficult.', sub: 'Traditional methods lack data-driven insights for strategic brand evolution.' },
              ].map((item, i) => (
                <div key={i} className="group relative bg-white rounded-2xl p-8 shadow-sm border border-neutral-200 hover:shadow-lg hover:border-yellow-400/50 transition-all duration-300 flex flex-col">
                  <div className="mb-6 inline-flex items-center justify-center rounded-xl bg-yellow-400/10 p-3 ring-1 ring-yellow-400/20">
                    <item.icon className="size-6 text-yellow-600" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-neutral-900">{item.title}</h3>
                  <p className="mb-6 text-neutral-600 leading-relaxed">{item.desc}</p>
                  <div className="mt-auto pt-6 border-t border-neutral-100">
                    <p className="text-sm text-neutral-500 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 mt-1.5 shrink-0"></span>
                      {item.sub}
                    </p>
                  </div>
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-neutral-900/0 group-hover:ring-neutral-900/5 transition-all pointer-events-none"></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Solutions */}
        <section className="bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl mb-4">AI That Solves Your Brand Challenges</h2>
              <p className="text-lg text-neutral-600">Helio uses artificial intelligence to maintain consistency, adapt to change, and guide smarter brand decisions.</p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {[
                { icon: Settings, title: 'Consistent Integration', desc: 'AI-powered brand consistency across all touchpoints', sub: 'Automatically maintain brand guidelines with intelligent monitoring and enforcement.' },
                { icon: LayoutTemplate, title: 'Dynamic Flexibility', desc: 'Adapt intelligently to any platform or format', sub: 'Smart adaptation engine that adjusts your brand for any channel while preserving identity.' },
                { icon: TrendingUp, title: 'Predictive Analytics', desc: 'Data-driven insights for future brand strategy', sub: 'AI analyzes trends and performance to recommend strategic brand evolution.' },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-yellow-400 shadow-sm">
                    <item.icon className="size-8 text-neutral-900" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-neutral-900">{item.title}</h3>
                  <p className="text-neutral-900 font-medium mb-4">{item.desc}</p>
                  <p className="text-neutral-600 leading-relaxed text-sm">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 sm:py-28 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl bg-neutral-900 rounded-[2.5rem] p-10 sm:p-16 lg:p-20 relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 -z-10 overflow-hidden">
              <div className="absolute left-1/2 top-0 -translate-x-1/2 opacity-20">
                <div className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-br from-yellow-400 to-transparent blur-3xl"></div>
              </div>
            </div>
            
            <div className="text-center mb-16 relative z-10">
              <p className="text-yellow-400 text-sm font-semibold tracking-wider uppercase mb-4">How the Helio Platform Works</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white max-w-3xl mx-auto leading-tight tracking-tight">
                From brand input to intelligent execution — powered by AI and designed for continuous improvement.
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 relative z-10">
              {[
                { step: '01', title: 'Brand Input', desc: 'Upload your brand assets and guidelines' },
                { step: '02', title: 'AI Analysis', desc: 'Deep learning analyzes your brand DNA' },
                { step: '03', title: 'Strategy Map', desc: 'Generate adaptive brand strategies' },
                { step: '04', title: 'Integration', desc: 'Apply across all touchpoints' },
                { step: '05', title: 'Optimize', desc: 'Continuous learning and refinement' },
              ].map((item, i) => (
                <div key={i} className="relative">
                  <div className="text-yellow-400 text-3xl font-bold mb-4 opacity-80">{item.step}</div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">{item.desc}</p>
                  {i < 4 && (
                    <div className="hidden lg:block absolute top-4 left-12 right-0 h-px bg-neutral-800">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center mb-20 sm:mb-28">
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl mb-6">Everything You Need to Build and Run an Intelligent Brand</h2>
              <p className="text-lg text-neutral-600">Helio delivers a suite of AI-powered products designed to define, systemize, and scale your brand. Use them independently or combine them to create a fully integrated brand ecosystem.</p>
            </div>

            <div className="space-y-24 lg:space-y-32">
              {[
                { title: 'Brand Integrator Brain', desc: 'An AI-powered Process Center which create integrity by codifying the Brand City Canvas and turn into brand\'s digital twin with 91% accuracy in decision making and action.', btn: 'Learn More', img: 'https://picsum.photos/seed/brain/800/600' },
                { title: 'Soul print', desc: 'A journey of experiences for variety of media, from rigid physical products and spaces to objective social media campaigns, designed to help audiences to get involve with brand value and culture.', btn: 'Try it out', img: 'https://picsum.photos/seed/soul/800/600', reverse: true, link: '/soul-print' },
                { title: 'Brand Canvas', desc: 'A set of strategic guidelines for designers and executives which enlightens Brand Identity and Culture to integrate brand messages', btn: 'See All Plugin Agents', img: 'https://picsum.photos/seed/canvas/800/600' },
                { title: 'Plug-in Agents', desc: 'Technology-based special tools, can automate business processes in variety of aspects, align with brand Identity.', btn: 'Learn More', img: 'https://picsum.photos/seed/plugin/800/600', reverse: true, link: '/agent-store' },
                { title: 'Content Factory', desc: 'Schedule, monitor and counsel in execution and manufacturing processes, to make sure that every step of experiences and the sequence of them works effective in action.', btn: 'Learn More', img: 'https://picsum.photos/seed/factory/800/600' },
              ].map((feature, i) => (
                <div key={i} className={`relative flex flex-col gap-10 lg:flex-row lg:gap-16 items-center ${feature.reverse ? 'lg:flex-row-reverse' : ''}`}>
                  <div className="flex-1 lg:w-1/2">
                    <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-yellow-400/10 p-2">
                      <span className="text-sm font-semibold text-yellow-600">0{i + 1}</span>
                    </div>
                    <h3 className="text-3xl font-semibold text-neutral-900 mb-6">{feature.title}</h3>
                    <p className="text-lg text-neutral-600 mb-8 leading-relaxed">{feature.desc}</p>
                    <button 
                      onClick={() => {
                        if (feature.link) {
                          navigate(feature.link);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 h-10 px-6"
                    >
                      {feature.btn}
                    </button>
                  </div>
                  <div className="flex-1 lg:w-1/2 w-full">
                    <div className="relative rounded-2xl bg-neutral-100 p-2 ring-1 ring-inset ring-neutral-900/5 shadow-sm">
                      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
                        <img src={feature.img} alt={feature.title} className="w-full aspect-[4/3] object-cover" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Case Studies */}
        <section className="py-20 sm:py-28 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl bg-neutral-50 rounded-[2.5rem] p-8 sm:p-12 lg:p-16 border border-neutral-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl mb-4">Proven Results Across Brands</h2>
                <p className="text-lg text-neutral-600">Explore how leading brands use Helio to achieve consistency, scalability, and measurable growth.</p>
              </div>
              <button className="bg-yellow-400 hover:bg-yellow-500 text-neutral-900 px-6 py-2.5 rounded-md text-sm font-semibold transition-colors shrink-0">
                View All Works
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              {[
                { title: 'Binghatti', desc: 'Architect who works with top brands to develop major residential projects in UAE. Our plug-in agents help them to achieve unlimited ideas more rapidly.', img: 'https://picsum.photos/seed/binghatti/600/400' },
                { title: 'Mansory', desc: 'Well reputed world class automobile manufacturer and tuner. With an integrator brain, they can have well-integrated outputs for every touchpoint across all channels.', img: 'https://picsum.photos/seed/mansory/600/400' },
                { title: 'Technogym', desc: 'Sports equipment provider works with F1, Olympics and top sports. Every dream can be visualize with a proper image or video generator agent.', img: 'https://picsum.photos/seed/technogym/600/400' },
              ].map((study, i) => (
                <div key={i} className="group cursor-pointer bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm hover:shadow-md transition-all">
                  <div className="bg-neutral-100 rounded-xl aspect-video mb-5 overflow-hidden">
                    <img src={study.img} alt={study.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />
                  </div>
                  <div className="px-2 pb-2">
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2">{study.title}</h3>
                    <p className="text-neutral-600 text-sm mb-4 line-clamp-3 leading-relaxed">{study.desc}</p>
                    <div className="font-semibold text-sm flex items-center gap-2 text-neutral-900 group-hover:text-yellow-600 transition-colors">
                      Read more <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 justify-center md:justify-start">
              <button className="w-10 h-10 rounded-full border border-neutral-300 flex items-center justify-center hover:bg-white hover:shadow-sm transition-all bg-transparent text-neutral-600">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 rounded-full border border-neutral-300 flex items-center justify-center hover:bg-white hover:shadow-sm transition-all bg-transparent text-neutral-600">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
