'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { PenLine, FileText, MessageSquare, Package, Settings, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from './ui/button';

const navigation = [
  { name: 'Capture', href: '/capture', icon: PenLine },
  { name: 'Notes', href: '/notes', icon: FileText },
  { name: 'Ask', href: '/ask', icon: MessageSquare },
  { name: 'Packs', href: '/packs', icon: Package },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col z-50">
        <div className="flex min-h-0 flex-1 flex-col border-r border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="flex flex-1 flex-col overflow-y-auto pt-6 pb-4">
            <div className="flex flex-shrink-0 items-center px-6 mb-6">
              <h1 className="text-xl font-bold tracking-tight text-foreground">PKP</h1>
            </div>
            <nav className="flex-1 space-y-1 px-3">
              {navigation.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      isActive
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      'group flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200'
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                        'mr-3 h-5 w-5 flex-shrink-0 transition-colors'
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex flex-shrink-0 border-t border-border/50 p-4 bg-muted/30">
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-background/80 backdrop-blur-xl px-4 py-3 border-b border-border/50 md:hidden transition-all duration-200">
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="-ml-2">
          <Menu className="h-6 w-6 text-foreground" />
        </Button>
        <div className="flex-1 text-base font-semibold leading-6 text-foreground">PKP</div>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
              <h1 className="text-xl font-bold tracking-tight text-foreground">PKP</h1>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="-mr-2">
                <X className="h-6 w-6 text-muted-foreground" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      isActive
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      'group flex items-center rounded-xl px-3 py-3 text-base font-medium transition-all duration-200'
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                        'mr-4 h-6 w-6 flex-shrink-0'
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
