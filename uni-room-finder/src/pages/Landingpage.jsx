import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="bg-slate-900 text-slate-50 antialiased selection:bg-emerald-400 selection:text-slate-900 overflow-x-hidden flex flex-col min-h-screen">
      
      {/* Background Glowing Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* Navigation */}
      <nav className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-400 flex items-center justify-center text-slate-900 font-bold text-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
          </div>
          <span className="font-bold text-xl tracking-tight text-white">RoomFinder</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#roadmap" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">Roadmap</a>
          <Link to="/app" className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors">Open App</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-16 pb-24 flex flex-col items-center text-center flex-grow">
        
        {/* Live Data Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700 backdrop-blur-md mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
          <span className="text-slate-300 text-xs font-bold uppercase tracking-widest">Live Campus Data</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 max-w-4xl leading-[1.1]">
          Stop wandering the halls. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Find a free room instantly.</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl leading-relaxed">
          The lightning-fast room availability tracker built for the Deggendorf Institute of Technology. Find empty study spots across campus in real-time.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-20">
          <Link to="/app" className="group relative px-8 py-4 bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-bold rounded-2xl transition-all active:scale-95 shadow-[0_0_40px_rgba(52,211,153,0.3)] hover:shadow-[0_0_60px_rgba(52,211,153,0.5)] flex items-center justify-center gap-2">
            Launch App
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </Link>
        </div>

        {/* ROADMAP / COMING SOON SECTION */}
        <section id="roadmap" className="w-full text-left pt-16 border-t border-slate-800">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">What's Next?</h2>
            <p className="text-slate-400 max-w-2xl text-lg">We are actively building the ultimate student utility. Here is a sneak peek at the features currently in development.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1: Social Check-ins */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm hover:bg-slate-800/60 transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">In Progress</div>
              <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Social Check-ins</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Join a room and optionally share your course name. Find out if the people inside are studying Electronics Engineering or working on a project you can join!</p>
            </div>

            {/* Feature 2: Smart Hardware Filters */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm hover:bg-slate-800/60 transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 bg-slate-700 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Planned</div>
              <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Hardware Filters</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Need a room with specific tools? Soon you will be able to filter by rooms that have active projectors, whiteboards, or dedicated EDV PC labs.</p>
            </div>

            {/* Feature 3: Schedule Integration */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm hover:bg-slate-800/60 transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 bg-slate-700 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Planned</div>
              <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Schedule Insights</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Want to stay all afternoon? We are working on showing you exactly how long a room will stay free before the next lecture begins.</p>
            </div>

          </div>
        </section>

      </main>

      {/* PROFESSIONAL FOOTER */}
      <footer className="w-full bg-slate-900 border-t border-slate-800 mt-auto py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Left Side: Brand & Copyright */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md bg-emerald-400 flex items-center justify-center text-slate-900">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
              </div>
              <span className="font-bold text-slate-300">RoomFinder</span>
            </div>
            <p className="text-slate-500 text-xs">
              © 2026 TG. All rights reserved.
            </p>
            <p className="text-slate-600 text-xs mt-1">
              Not officially affiliated with the Deggendorf Institute of Technology.
            </p>
          </div>

          {/* Right Side: Links */}
          <div className="flex gap-6 text-sm text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;