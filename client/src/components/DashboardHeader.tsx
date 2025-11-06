import { Button } from "@/components/ui/button";
import { BookOpen, Home, TrendingUp, Brain, FileText, MessageSquare, LogOut, Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { label: "Dashboard", path: "/dashboard", icon: <Home className="h-4 w-4" /> },
    { label: "Practice Vocabulary", path: "/vocabulary", icon: <Brain className="h-4 w-4" /> },
    { label: "View All Words", path: "/vocabulary-list", icon: <FileText className="h-4 w-4" /> },
    { label: "View Progress", path: "/progress", icon: <TrendingUp className="h-4 w-4" /> },
  ];

  const isActive = (path: string) => location === path;

  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container py-2 md:py-3">
        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/dashboard">
            <div className="flex items-center gap-2 cursor-pointer flex-shrink-0">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-bold">Serbian AI Tutor</h1>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-2 flex-1">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={isActive(item.path) ? "default" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  {item.icon}
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Right Side - User Info & Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {user?.name || user?.email}
              </span>
              {user?.isBetaTester && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-sm">
                  ✨ Beta Tester
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-2">
            <Link href="/dashboard">
              <div className="flex items-center gap-2 cursor-pointer">
                <BookOpen className="h-5 w-5 text-primary" />
                <h1 className="text-sm font-bold">Serbian AI Tutor</h1>
              </div>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="space-y-2 pt-2 border-t">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive(item.path) ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.icon}
                    {item.label}
                  </Button>
                </Link>
              ))}
              <div className="border-t pt-2 space-y-2">
                <div className="text-xs text-muted-foreground px-2 py-1">
                  {user?.name || user?.email}
                </div>
                {user?.isBetaTester && (
                  <div className="px-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-sm">
                      ✨ Beta Tester
                    </span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start gap-2 text-xs"
                >
                  <LogOut className="h-3 w-3" />
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

