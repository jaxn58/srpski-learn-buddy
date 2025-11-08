import { Button } from "@/components/ui/button";
import { BookOpen, Home, TrendingUp, Brain, FileText, LogOut, Menu, X, ChevronLeft, ChevronRight, MessageSquare, Shield, Users, MessageCircle, UserPlus, Trophy, Star, Flame, Award } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

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
  
  // Fetch gamification stats
  const { data: progress } = trpc.progress.get.useQuery();

  const navItems: NavItem[] = [
    { label: "Dashboard", path: "/dashboard", icon: <Home className="h-5 w-5" /> },
    { label: "Practice Vocabulary", path: "/vocabulary", icon: <Brain className="h-5 w-5" /> },
    { label: "View All Words", path: "/vocabulary-list", icon: <FileText className="h-5 w-5" /> },
    { label: "View Progress", path: "/progress", icon: <TrendingUp className="h-5 w-5" /> },
    { label: "Send Feedback", path: "/feedback", icon: <MessageSquare className="h-5 w-5" /> },
  ];

  const adminItems: NavItem[] = [
    { label: "User Management", path: "/admin", icon: <Users className="h-4 w-4" /> },
    { label: "Feedback", path: "/admin/feedback", icon: <MessageCircle className="h-4 w-4" /> },
    { label: "Beta Registrations", path: "/admin/beta-registrations", icon: <UserPlus className="h-4 w-4" /> },
  ];

  const isActive = (path: string) => location === path;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

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

        {/* User Cockpit */}
        {!collapsed && (
          <div className="p-4 border-b bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="space-y-3">
              {/* User Info */}
              <div className="space-y-1">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {user?.name || user?.email}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {user?.role === 'superadmin' ? 'Superadmin' : user?.role === 'admin' ? 'Admin' : 'Student'}
                  </span>
                  {user?.isBetaTester && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-medium">
                      ✨ Beta
                    </span>
                  )}
                </div>
              </div>
              
              {/* Gamification Stats */}
              {user && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/10">
                  {/* Level */}
                  <div className="bg-white/50 rounded-lg p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <Trophy className="h-3 w-3 text-yellow-600" />
                      <span className="text-xs font-medium text-gray-600">Level</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{user.level || 1}</div>
                    <div className="text-xs text-gray-500">{300 - ((user.totalXP || 0) % 300)} XP to next</div>
                  </div>
                  
                  {/* Total XP */}
                  <div className="bg-white/50 rounded-lg p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <Star className="h-3 w-3 text-blue-600" />
                      <span className="text-xs font-medium text-gray-600">Total XP</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{user.totalXP || 0}</div>
                    <div className="text-xs text-gray-500">Points earned</div>
                  </div>
                  
                  {/* Streak */}
                  <div className="bg-white/50 rounded-lg p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <Flame className="h-3 w-3 text-orange-600" />
                      <span className="text-xs font-medium text-gray-600">Streak</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{user.currentStreak || 0} 🔥</div>
                    <div className="text-xs text-gray-500">Days in a row</div>
                  </div>
                  
                  {/* Badges */}
                  <div className="bg-white/50 rounded-lg p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <Award className="h-3 w-3 text-purple-600" />
                      <span className="text-xs font-medium text-gray-600">Badges</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">3</div>
                    <div className="text-xs text-gray-500">Achievements</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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

          {/* Admin Section */}
          {isAdmin && !collapsed && (
            <div className="pt-4 mt-4 border-t">
              <div className="flex items-center gap-2 px-3 py-2 mb-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Admin Panel
                </span>
              </div>
              <div className="space-y-1">
                {adminItems.map((item) => (
                  <Link key={item.path} href={item.path}>
                    <button
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                        "hover:bg-red-50 hover:shadow-sm",
                        isActive(item.path)
                          ? "bg-red-100 text-red-700 shadow-md"
                          : "text-gray-600"
                      )}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    </button>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Logout Section */}
        <div className="p-3 border-t">
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

