'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  User, 
  Target, 
  CalendarDays, 
  FolderGit2, 
  AudioWaveform, 
  TrendingUp, 
  Send,
  Compass,
  LayoutDashboard,
  Menu,
  X
} from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/profile', label: 'Profile', icon: User },
    { href: '/skill-gaps', label: 'Skill Gaps', icon: Target },
    { href: '/learning-plan', label: 'Learning Plan', icon: CalendarDays },
    { href: '/projects', label: 'Projects', icon: FolderGit2 },
    { href: '/mock-interview', label: 'Mock Interview', icon: AudioWaveform },
    { href: '/progress', label: 'Progress', icon: TrendingUp },
    { href: '/applications', label: 'Applications', icon: Send },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* ZONE 1 (LEFT): Product Logo & Brand Title */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
                <Compass size={18} className="w-4 h-4 shrink-0 text-slate-100" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Career Pivot Coach
              </span>
            </Link>
          </div>

          {/* ZONE 2 (CENTER DESKTOP): Single clean navigation bar */}
          <nav aria-label="Desktop Navigation" className="hidden md:flex items-center gap-1 justify-center flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 font-medium'
                  }`}
                >
                  <Icon size={16} className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-900 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* ZONE 3 (RIGHT): Mobile Menu Trigger */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} className="w-5 h-5 shrink-0" /> : <Menu size={20} className="w-5 h-5 shrink-0" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Menu (Strictly md:hidden and only renders when open) */}
        {mobileMenuOpen && (
          <nav aria-label="Mobile Dropdown Menu" className="md:hidden border-t border-slate-200 dark:border-slate-800 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon size={18} className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

      </div>
    </header>
  );
}
