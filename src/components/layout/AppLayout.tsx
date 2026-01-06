import { ReactNode, forwardRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Music2, Upload, Library, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = forwardRef<HTMLDivElement, AppLayoutProps>(function AppLayout({ children }, ref) {
  const { t } = useTranslation();
  const location = useLocation();

  const navigation = [
    { href: '/upload', label: t('navigation.upload'), icon: Upload },
    { href: '/library', label: t('navigation.library'), icon: Library },
  ];

  return (
    <div ref={ref} className="min-h-screen flex flex-col bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/library" className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Music2 className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold hidden sm:inline">{t('common.appName')}</span>
          </Link>

          {/* Main Navigation */}
          <nav className="flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/library' && location.pathname.startsWith(item.href));
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2',
                      isActive && 'bg-secondary text-secondary-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
});