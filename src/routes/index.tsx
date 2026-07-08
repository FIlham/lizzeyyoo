import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline();

    // Hero Animations
    tl.from(".hero-element", {
      y: 40,
      opacity: 0,
      duration: 1,
      stagger: 0.15,
      ease: "power3.out",
      delay: 0.2
    });

    tl.from(".gallery-img", {
      scale: 0.9,
      opacity: 0,
      duration: 1,
      stagger: 0.1,
      ease: "power2.out"
    }, "-=0.5");

    // About Section Animations
    gsap.from(".about-element", {
      scrollTrigger: {
        trigger: ".about-section",
        start: "top 80%",
      },
      y: 50,
      opacity: 0,
      duration: 1,
      stagger: 0.2,
      ease: "power3.out"
    });

    // Connect Section Animations
    gsap.from(".connect-element", {
      scrollTrigger: {
        trigger: ".connect-section",
        start: "top 90%",
      },
      y: 40,
      opacity: 0,
      duration: 1,
      stagger: 0.15,
      ease: "power3.out"
    });

  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-zinc-900/40 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="text-2xl font-medium tracking-tight hero-element">Lizzeyyoo</div>
        <div className="flex items-center gap-6 hero-element">
          <Link to="/dashboard" className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors">
            Login
          </Link>
          <Link to="/dashboard" className="text-sm font-medium bg-zinc-100 text-zinc-950 px-4 py-2 rounded-sm hover:bg-zinc-200 transition-colors">
            Get Started
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-8 text-center mt-20 mb-32">
        <div className="max-w-4xl space-y-8">
          <h1 className="text-6xl md:text-8xl font-semibold tracking-tighter leading-tight text-zinc-100 hero-element">
            Financial clarity,<br />
            <span className="text-zinc-500">without the noise.</span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-light leading-relaxed hero-element">
            Record daily transactions with a single text input. Consult your financial health with our AI assistant. Simple, fast, and brutalistically clean.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 hero-element">
            <Link to="/dashboard" className="px-8 py-4 bg-zinc-100 text-zinc-950 font-medium text-lg rounded-sm hover:bg-zinc-300 transition-all flex items-center gap-2">
              Open Dashboard
            </Link>
            <Link to="/chat" className="px-8 py-4 bg-transparent border border-zinc-700 text-zinc-300 font-medium text-lg rounded-sm hover:bg-zinc-900 hover:text-zinc-100 transition-all">
              Try AI Chat
            </Link>
          </div>
        </div>

        {/* Hero Gallery Grid */}
        <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-6xl">
          <div className="aspect-[4/5] bg-zinc-900 relative group overflow-hidden gallery-img">
            <img src="/lizzy/1.jpg" alt="Design detail" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500 grayscale group-hover:grayscale-0" />
          </div>
          <div className="aspect-[4/5] bg-zinc-900 relative group overflow-hidden md:-translate-y-8 gallery-img">
            <img src="/lizzy/3.jpg" alt="Design detail" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500 grayscale group-hover:grayscale-0" />
          </div>
          <div className="aspect-[4/5] bg-zinc-900 relative group overflow-hidden gallery-img">
            <img src="/lizzy/6.jpg" alt="Design detail" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500 grayscale group-hover:grayscale-0" />
          </div>
          <div className="aspect-[4/5] bg-zinc-900 relative group overflow-hidden md:-translate-y-8 gallery-img">
            <img src="/lizzy/8.jpg" alt="Design detail" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500 grayscale group-hover:grayscale-0" />
          </div>
        </div>
      </main>

      {/* About Section - 2 Columns */}
      <section className="about-section relative z-10 w-full max-w-6xl mx-auto px-8 py-32 border-t border-zinc-900">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="aspect-square bg-zinc-900 relative group overflow-hidden about-element border border-zinc-800">
            <img src="/lizzy/5.jpg" alt="Minimalist Interface" className="absolute inset-0 w-full h-full object-cover opacity-70 grayscale hover:grayscale-0 hover:opacity-100 hover:scale-105 transition-all duration-700 ease-out" />
          </div>
          <div className="text-left space-y-8 about-element">
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-zinc-100">About Lizzeyyoo</h2>
            <div className="text-lg text-zinc-400 font-light leading-relaxed space-y-6">
              <p>
                Lizzeyyoo was born out of a desire for absolute simplicity in personal finance. Traditional tracking apps are cluttered with charts, notifications, and unnecessary features. We built a system that gets out of your way.
              </p>
              <p>
                By combining a brutalist, distraction-free interface with a powerful AI backend, Lizzeyyoo allows you to record transactions via natural language and consult your financial health instantly, without clicking through endless menus.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Connect Section */}
      <section className="connect-section relative z-10 w-full max-w-6xl mx-auto px-8 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-px bg-zinc-800 border border-zinc-800 rounded-sm overflow-hidden">

          {/* Left Column (Image & Brand) */}
          <div className="connect-element md:col-span-5 bg-zinc-950">
            <div className="relative h-[450px] md:h-[500px] p-8 flex flex-col justify-between group overflow-hidden">
              <img
                src="/lizzy/10.jpg"
                alt="Connect with us"
                className="absolute inset-0 w-full h-full object-cover object-top opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-80 transition-all duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

              <div className="relative z-10">
              </div>

              <div className="relative z-10 space-y-2">
                <h2 className="text-3xl font-medium tracking-tight text-white">Lizzy Hub</h2>
                <p className="text-sm text-zinc-400 font-light max-w-sm">
                  Join the community, follow the roadmap, and track our journey.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column (Socials) */}
          <div className="md:col-span-7 flex flex-col divide-y divide-zinc-800 bg-zinc-950">

            {/* Twitter */}
            <div className="connect-element flex-1 flex">
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 p-8 hover:bg-zinc-900/30 transition-all duration-300 flex items-center justify-between group"
              >
                <div className="space-y-1">
                  <span className="block text-xl text-zinc-100 font-medium group-hover:text-white transition-colors">Twitter / X</span>
                  <span className="text-sm text-zinc-500 font-light block">Follow for daily updates and thoughts</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-white group-hover:border-zinc-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300">
                    <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
              </a>
            </div>

            {/* GitHub */}
            <div className="connect-element flex-1 flex">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 p-8 hover:bg-zinc-900/30 transition-all duration-300 flex items-center justify-between group"
              >
                <div className="space-y-1">
                  <span className="block text-xl text-zinc-100 font-medium group-hover:text-white transition-colors">GitHub Repository</span>
                  <span className="text-sm text-zinc-500 font-light block">View source code and contribute</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-white group-hover:border-zinc-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300">
                    <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
              </a>
            </div>

            {/* Discord */}
            <div className="connect-element flex-1 flex">
              <a
                href="https://discord.gg"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 p-8 hover:bg-zinc-900/30 transition-all duration-300 flex items-center justify-between group"
              >
                <div className="space-y-1">
                  <span className="block text-xl text-zinc-100 font-medium group-hover:text-white transition-colors">Discord Server</span>
                  <span className="text-sm text-zinc-500 font-light block">Join the community discussions</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-white group-hover:border-zinc-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300">
                    <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
              </a>
            </div>

          </div>
        </div>
      </section>

      <footer className="relative z-10 py-12 px-8 border-t border-zinc-900 mt-auto flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-500 text-xs text-center max-w-2xl font-light leading-relaxed">
          Disclaimer: Lizzeyyoo is a prototype MVP and should not be used as your sole financial advisory tool. Data is stored locally. We do not collect or sell your personal financial data.
        </p>
        <p className="text-zinc-600 text-sm">
          &copy; 2026 Lizzeyyoo. Minimalist Financial Prototype.
        </p>
      </footer>
    </div>
  );
}
