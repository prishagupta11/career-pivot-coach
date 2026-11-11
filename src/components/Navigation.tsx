'use client';

import { useState, useRef, useEffect } from 'react';
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
  X,
  LogOut,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Navigation() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  // Close user dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const initial = (user?.displayName?.[0] || user?.email?.[0] || 'U').toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
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

          {/* ZONE 2 (CENTER DESKTOP): Navigation bar */}
          <nav aria-label="Desktop Navigation" className="hidden lg:flex items-center gap-1 justify-center flex-1">
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

          {/* ZONE 3 (RIGHT): User Account Menu & Mobile Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Desktop User Avatar & Menu */}
            {user && (
              <div className="hidden md:block relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  {user.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-medium text-xs flex items-center justify-center">
                      {initial}
                    </div>
                  )}
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown size={14} className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Popover */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {displayName}
                      </p>
                      {user.email && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {user.email}
                        </p>
                      )}
                    </div>
                    <div className="pt-1">
                      <Link
                        href="/onboarding"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <RotateCcw size={14} className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>Redo setup</span>
                      </Link>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <LogOut size={14} className="w-3.5 h-3.5 shrink-0" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} className="w-5 h-5 shrink-0" /> : <Menu size={20} className="w-5 h-5 shrink-0" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <nav aria-label="Mobile Dropdown Menu" className="lg:hidden border-t border-slate-200 dark:border-slate-800 py-3 space-y-1">
            {/* User Profile Info on Mobile */}
            {user && (
              <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-medium text-xs flex items-center justify-center shrink-0">
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {displayName}
                    </p>
                    {user.email && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href="/onboarding"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 transition-colors"
                  >
                    <RotateCcw size={13} className="w-3.5 h-3.5 shrink-0" />
                    <span>Redo setup</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    <LogOut size={13} className="w-3.5 h-3.5 shrink-0" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}

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
