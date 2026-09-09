import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="bg-slate-50 text-slate-900 font-Rubik antialiased min-h-screen flex flex-col selection:bg-emerald-200 selection:text-emerald-900">
      
      {/* Navigation */}
      <nav className="w-full border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">THD RoomFinder</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#roadmap" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Roadmap</a>
            <Link to="/app" className="text-sm font-semibold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm">Open App</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-24 flex flex-col items-center text-center flex-grow">
        
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-slate-700 text-xs font-semibold uppercase tracking-wider">Live Campus Infrastructure</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 max-w-4xl leading-tight">
          Stop wandering campus buildings. <br />
          <span className="text-emerald-600">Find an open room instantly.</span>
        </h1>

        <p className="text-base md:text-lg text-slate-600 mb-10 max-w-2xl leading-relaxed font-normal">
          A high-performance room availability utility built for students at the Deggendorf Institute of Technology. Check real-time schedules before you walk across campus.
        </p>

        {/* CTA */}
        <div className="flex gap-4 mb-24">
          <Link to="/app" className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2">
            Launch Application
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </Link>
        </div>

        {/* Roadmap Section */}
        <section id="roadmap" className="w-full text-left pt-12 border-t border-slate-200">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Development Roadmap</h2>
            <p className="text-slate-600 text-sm">Planned feature expansions for the campus toolset.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm relative">
              <div className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 w-max mb-4">In Progress</div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Social Check-ins</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Optional room check-ins to see which study groups or project teams are working in specific spaces.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm relative">
              <div className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 w-max mb-4">Planned</div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Hardware Filters</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Filter available rooms by specific utilities such as projectors, whiteboards, or computer lab setups.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm relative">
              <div className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 w-max mb-4">Planned</div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Schedule Integration</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Precise timeline countdowns showing exact occupancy durations before the next scheduled lecture.</p>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full bg-slate-100 border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <div>
            <p className="font-medium text-slate-700">THD RoomFinder • Developed independently by Uchenna</p>
            <p className="mt-1">Not an official application of the Deggendorf Institute of Technology.</p>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-800 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-800 transition-colors">Terms</a>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;