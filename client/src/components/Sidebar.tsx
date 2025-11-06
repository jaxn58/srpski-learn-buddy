import { Button } from "@/components/ui/button";
import { BookOpen, Home, TrendingUp, Brain, FileText, LogOut, Menu, X, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { label: "Dashboard", path: "/dashboard", icon: <Home className="h-5 w-5" /> },
    { label: "Practice Vocabulary", path: "/vocabulary", icon: <Brain className="h-5 w-5" /> },
    { label: "View All Words", path: "/vocabulary-list", icon: <FileText className="h-5 w-5" /> },
    { label: "View Progress", path: "/progress", icon: <TrendingUp className="h-5 w-5" /> },
    { label: "Send Feedback", path: "/feedback", icon: <MessageSquare className="h-5 w-5" /> },
  ];

  const isActive = (path: string) => location === path;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-card border-r flex flex-col transition-all duration-300 z-40",
          collapsed ? "w-20" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          {!collapsed && (
            <Link href="/dashboard">
              <div className="flex items-center gap-2 cursor-pointer">
                <BookOpen className="h-6 w-6 text-primary flex-shrink-0" />
                <div className="flex flex-col">
                  <h1 className="text-sm font-bold leading-tight">Serbian</h1>
                  <span className="text-xs text-muted-foreground leading-tight">AI Tutor</span>
                </div>
              </div>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard">
              <BookOpen className="h-6 w-6 text-primary cursor-pointer mx-auto" />
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:block p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <button
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                  "hover:bg-gray-100 hover:shadow-sm",
                  isActive(item.path)
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-gray-700"
                )}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <span className="text-sm font-medium truncate">{item.label}</span>
                )}
              </button>
            </Link>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t space-y-2">
          {!collapsed && (
            <div className="px-3 py-2 space-y-1">
              <div className="text-sm font-medium truncate">
                {user?.name || user?.email}
              </div>
              {user?.isBetaTester && (
                <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-sm">
                  ✨ Beta Tester
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => {
              logout();
              setMobileOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
              "hover:bg-red-50 hover:text-red-600 text-gray-700"
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Spacer for main content */}
      <div className={cn("hidden md:block", collapsed ? "w-20" : "w-64")} />
    </>
  );
}

