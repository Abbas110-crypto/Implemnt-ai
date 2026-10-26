import { Link, useNavigate } from 'react-router-dom';
import { Zap, Bot, AlertTriangle, BarChart3, CheckCircle2, ArrowRight, Calendar, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

const features = [
  {
    icon: TrendingUp,
    title: 'Onboarding Execution Intelligence',
    description: 'Milestones, stages, and blockers update themselves based on what was actually said on calls — not what someone remembered to log.',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: AlertTriangle,
    title: 'Onboarding Risk Detection',
    description: 'Configured keyword rules surface timeline slips, unresolved blockers, and other implementation risks.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Bot,
    title: 'Implementation Coordination',
    description: 'Auto-capture action items, owners, and dependencies from every client call and route them directly into your workflow.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Zap,
    title: 'Real-Time System Updates',
    description: 'Your CRM, project boards, and onboarding trackers stay current automatically — no CSM copy-paste required.',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    icon: BarChart3,
    title: 'Onboarding Visibility',
    description: 'Leadership gets live health scores, milestone progress, and risk flags across every implementation — not a stale spreadsheet.',
    color: 'bg-sky-50 text-sky-600',
  },
  {
    icon: Calendar,
    title: 'CS Workflow Depth',
    description: 'Built for implementation-heavy CS teams at B2B SaaS companies — not a generic note-taker bolted onto your stack.',
    color: 'bg-violet-50 text-violet-600',
  },
];

const stats = [
  { value: '100%', label: 'Onboarding data that reflects reality' },
  { value: '0', label: 'Manual system updates after calls' },
  { value: '3x', label: 'Implementation risks caught earlier' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleSignUp = () => {
    navigate(isAuthenticated ? '/dashboard' : '/login');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">Implemnt</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleSignUp}>{isAuthenticated ? 'Dashboard' : 'Sign in'}</Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSignUp}>
              {isAuthenticated ? 'Open workspace' : 'Get started free'}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-indigo-100">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Built for onboarding-intensive B2B SaaS teams
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight">
            Your onboarding systems should
            <span className="text-indigo-600"> update themselves</span>
          </h1>
          <p className="mt-6 text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Implemnt ensures your onboarding data reflects reality automatically — so your CSMs stop spending hours updating systems after every call.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
            <Button
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-8 h-12 text-base"
              onClick={handleSignUp}
            >
              {isAuthenticated ? 'Open workspace' : 'Start for free'} <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="lg" className="h-12 text-base px-8" onClick={handleSignUp}>
              See a demo
            </Button>
          </div>
          <p className="mt-4 text-xs text-slate-400">No credit card required · Setup in under 5 minutes</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-slate-50 border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-4xl font-extrabold text-indigo-600">{s.value}</p>
                <p className="text-sm text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Onboarding intelligence, not generic automation
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
              Implemnt is purpose-built for implementation-heavy Customer Success teams at Series A–C and mid-market B2B SaaS companies.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.color} mb-4`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-16">
            Make your onboarding data reflect reality
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Connect your calendar', desc: 'Your bot joins every implementation call automatically — no scheduling, no setup per meeting.' },
              { step: '02', title: 'Rules surface call updates', desc: 'Configured phrases flag milestone changes, risks, blockers, and follow-up items for review.' },
              { step: '03', title: 'Systems update themselves', desc: 'Your project tracker, CRM, and boards reflect reality without anyone manually updating them.' },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-indigo-600 rounded-3xl p-12 text-white shadow-xl shadow-indigo-200">
            <Users className="w-10 h-10 mx-auto mb-4 opacity-80" />
            <h2 className="text-3xl font-bold mb-4">Stop relying on CSMs to manually update systems after calls.</h2>
            <p className="text-indigo-200 mb-8 text-base leading-relaxed">
              Built for B2B SaaS teams with complex, implementation-heavy onboarding. If your CSMs are spending hours after every call keeping systems current — Implemnt fixes that.
            </p>
            <Button
              size="lg"
              className="bg-white text-indigo-700 hover:bg-indigo-50 gap-2 px-8 h-12 text-base font-semibold"
              onClick={handleSignUp}
            >
              {isAuthenticated ? 'Open workspace' : 'Get started free'} <ArrowRight className="w-4 h-4" />
            </Button>
            <p className="mt-4 text-xs text-indigo-300 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="font-semibold text-slate-700 text-sm">Implemnt</span>
        </div>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} Implemnt. All rights reserved. · <Link to="/privacy" className="hover:underline">Privacy Policy</Link></p>
      </footer>
    </div>
  );
}
