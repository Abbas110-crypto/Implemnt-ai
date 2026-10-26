import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Menu, X, Zap, Flag, Plug, Bot, ListTodo, Brain, LayoutTemplate } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import ProductTour from './onboarding/ProductTour';

const tourKeys = {
  '/dashboard': 'dashboard',
  '/clients': 'projects',
  '/calendarbots': 'calendar-bots',
  '/callinsights': 'call-insights',
  '/actionitems': 'action-items',
  '/riskkeywords': 'risk-keywords',
  '/integrations': 'integrations',
};

const navSections = [
  {
    label: null,
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Projects', path: '/clients', icon: Users },
    ]
  },
  {
    label: 'Calls',
    items: [
      { label: 'Calendar Bots', path: '/calendarbots', icon: Bot },
      { label: 'Call Insights', path: '/callinsights', icon: Brain },
      { label: 'Action Items', path: '/actionitems', icon: ListTodo },
    ]
  },
  {
    label: 'Configuration',
    items: [
      { label: 'Templates', path: '/templates', icon: LayoutTemplate },
      { label: 'Risk Keywords', path: '/riskkeywords', icon: Flag },
      { label: 'Integrations', path: '/integrations', icon: Plug },
    ]
  },
];

export default function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    appClient.auth.me().then(user => {
      if (user && !user.onboarding_tour_completed) {
        setTimeout(() => setShowTour(true), 800);
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 fixed inset-y-0 z-30">
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-900 text-lg tracking-tight">Implemnt</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-4">
          {navSections.map((section, si) => (
            <div key={si}>
              {section.label && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.label}</p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      data-tour={tourKeys[item.path]}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        active
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => appClient.auth.logout('/')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 w-full transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-slate-900">Implemnt</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/20" onClick={() => setMobileOpen(false)}>
          <div className="w-64 bg-white h-full pt-14 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
              {navSections.map((section, si) => (
                <div key={si}>
                  {section.label && (
                    <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.label}</p>
                  )}
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const active = location.pathname.startsWith(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            active
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <item.icon className="w-4 h-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="p-3 border-t border-slate-100">
              <button
                onClick={() => appClient.auth.logout('/')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 w-full transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {showTour && <ProductTour onComplete={() => setShowTour(false)} />}

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="pt-14 lg:pt-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
