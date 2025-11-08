import { Button } from "@/components/ui/button";
import { BookOpen, Home, TrendingUp, Brain, FileText, LogOut, Menu, X, ChevronLeft, ChevronRight, MessageSquare, Shield, Users, MessageCircle, UserPlus, Trophy, Star, Flame, Award } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc"; // User router now properly exported

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

// Badge helper functions
const getBadgeIcon = (badgeId: string) => {
  const icons: Record<string, string> = {
    'first_steps': '🎓',
    'airport_navigator': '✈️',
    'week_warrior': '🏆',
    'cafe_regular': '☕',
    'vocabulary_master': '📚',
  };
  return icons[badgeId] || '🏅';
};

const getBadgeName = (badgeId: string) => {
  const names: Record<string, string> = {
    'first_steps': 'First Steps',
    'airport_navigator': 'Airport Navigator',
    'week_warrior': 'Week Warrior',
    'cafe_regular': 'Cafe Regular',
    'vocabulary_master': 'Vocabulary Master',
  };
  return names[badgeId] || 'Achievement';
};

const getBadgeDescription = (badgeId: string) => {
  const descriptions: Record<string, string> = {
    'first_steps': 'Complete your first unit',
    'airport_navigator': 'Master Unit 1: At the Airport',
    'week_warrior': 'Complete your first week',
    'cafe_regular': 'Master cafe-related vocabulary',
    'vocabulary_master': 'Complete 100 vocabulary exercises',
  };
  return descriptions[badgeId] || 'Unlocked achievement';
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Fetch gamification stats
  const { data: progress } = trpc.progress.get.useQuery();
  const { data: badgeData } = trpc.user.getBadgeCount.useQuery();
  const { data: userBadges } = trpc.user.getBadges.useQuery();

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
                <div className="space-y-1.5">
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
                  
                  {/* Achievement Badge Icons */}
                  {userBadges && userBadges.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {userBadges.map((badge: any) => (
                        <Tooltip key={badge.id}>
                          <TooltipTrigger asChild>
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold cursor-help shadow-sm hover:scale-110 transition-transform">
                              {getBadgeIcon(badge.badgeId)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-semibold">{getBadgeName(badge.badgeId)}</p>
                              <p className="text-xs text-gray-500">{getBadgeDescription(badge.badgeId)}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Gamification Stats - Compact Rows */}
              {user && (
                <div className="space-y-1.5 pt-2 border-t border-primary/10">
                  {/* Level */}
                  <div className="flex items-center justify-between bg-white/50 rounded px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5 text-yellow-600" />
                      <span className="text-xs font-medium text-gray-600">Level</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-gray-900">{user.level || 1}</span>
                      <span className="text-xs text-gray-500">{300 - ((user.totalXP || 0) % 300)} XP to next</span>
                    </div>
                  </div>
                  
                  {/* Total XP */}
                  <div className="flex items-center justify-between bg-white/50 rounded px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-xs font-medium text-gray-600">Total XP</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-gray-900">{user.totalXP || 0}</span>
                      <span className="text-xs text-gray-500">Points earned</span>
                    </div>
                  </div>
                  
                  {/* Streak */}
                  <div className="flex items-center justify-between bg-white/50 rounded px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-orange-600" />
                      <span className="text-xs font-medium text-gray-600">Streak</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-gray-900">{user.currentStreak || 0} 🔥</span>
                      <span className="text-xs text-gray-500">Days in a row</span>
                    </div>
                  </div>
                  
                  {/* Badges */}
                  <div className="flex items-center justify-between bg-white/50 rounded px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5 text-purple-600" />
                      <span className="text-xs font-medium text-gray-600">Badges</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-gray-900">{badgeData?.count || 0}</span>
                      <span className="text-xs text-gray-500">Achievements</span>
                    </div>
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

