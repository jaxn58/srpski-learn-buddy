import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { APP_LOGO, APP_TITLE } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { 
  LayoutDashboard, 
  LogOut, 
  PanelLeft, 
  Users,
  BookOpen,
  Layers,
  Brain,
  FileText,
  TrendingUp,
  CreditCard,
  MessageSquare,
  Sparkles,
  MessageCircle,
  Mail,
  Trophy,
  Star,
  Flame,
  Award,
  Shield
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

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

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  return (
    <>
      <SignedIn>
        <SidebarProvider
          style={
            {
              "--sidebar-width": `${sidebarWidth}px`,
            } as CSSProperties
          }
        >
          <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
            {children}
          </DashboardLayoutContent>
        </SidebarProvider>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  // Fetch gamification stats from Convex
  const progress = useQuery(api.progress.getUserProgress);
  const userBadges = useQuery(api.badges.getUserBadges);
  const badgeCount = useQuery(api.badges.getBadgeCount);
  const badgeData = badgeCount !== undefined ? { count: badgeCount } : undefined;

  const navItems: NavItem[] = [
    { label: t('sidebar.dashboard'), path: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: t('sidebar.units'), path: "/units", icon: <Layers className="h-5 w-5" /> },
    {
      label: t('sidebar.aiLearnBuddy'),
      path: "/chat",
      icon: <Brain className="h-5 w-5 text-yellow-500" />,
    },
    { label: t('sidebar.practiceVocab'), path: "/vocabulary", icon: <BookOpen className="h-5 w-5" /> },
    { label: t('sidebar.viewAllWords'), path: "/vocabulary-list", icon: <FileText className="h-5 w-5" /> },
    { label: t('sidebar.viewProgress'), path: "/progress", icon: <TrendingUp className="h-5 w-5" /> },
    { label: t('sidebar.mySubscription'), path: "/subscription", icon: <CreditCard className="h-5 w-5" /> },
    { label: t('sidebar.sendFeedback'), path: "/feedback", icon: <MessageSquare className="h-5 w-5" /> },
  ];

  const adminItems: NavItem[] = [
    { label: t('sidebar.userManagement'), path: "/admin", icon: <Users className="h-4 w-4" /> },
    { label: "Prompt Admin", path: "/admin/prompt", icon: <Sparkles className="h-4 w-4" /> },
    { label: t('sidebar.feedback'), path: "/admin/feedback", icon: <MessageCircle className="h-4 w-4" /> },
    { label: t('sidebar.emailTemplates'), path: "/admin/email-templates", icon: <Mail className="h-4 w-4" /> },
    { label: t('sidebar.subscriptionAnalytics'), path: "/admin/subscription-analytics", icon: <TrendingUp className="h-4 w-4" /> },
  ];

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const activeMenuItem = [...navItems, ...(isAdmin ? adminItems : [])].find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 pl-2 group-data-[collapsible=icon]:px-0 transition-all w-full">
              {isCollapsed ? (
                <div className="relative h-8 w-8 shrink-0 group">
                  <img
                    src={APP_LOGO}
                    className="h-8 w-8 rounded-md object-cover ring-1 ring-border"
                    alt="Logo"
                  />
                  <button
                    onClick={toggleSidebar}
                    className="absolute inset-0 flex items-center justify-center bg-accent rounded-md ring-1 ring-border opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PanelLeft className="h-4 w-4 text-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={APP_LOGO}
                      className="h-8 w-8 rounded-md object-cover ring-1 ring-border shrink-0"
                      alt="Logo"
                    />
                    <span className="font-semibold tracking-tight truncate">
                      {APP_TITLE}
                    </span>
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="ml-auto h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  >
                    <PanelLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* User Cockpit */}
            {!isCollapsed && user && (
              <div className="px-3 py-2">
                <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-3 space-y-3 border">
                  {/* User Info */}
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {user.name || user.email}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {user.role === 'superadmin' ? t('sidebar.role.superadmin') : user.role === 'admin' ? t('sidebar.role.admin') : t('sidebar.role.student')}
                        </span>
                        {user.isBetaTester && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-medium">
                            {t('sidebar.beta')}
                          </span>
                        )}
                      </div>
                      
                      {/* Achievement Badge Icons */}
                      {userBadges && userBadges.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {userBadges.map((badge: any) => (
                            <Tooltip key={badge.id}>
                              <TooltipTrigger asChild>
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold cursor-help shadow-sm hover:scale-110 transition-transform">
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
                  
                  {/* Gamification Stats */}
                  {(() => {
                    const totalXP = user.totalXP || 0;
                    const currentLevel = user.level || 1;
                    const xpInCurrentLevel = totalXP % 300;
                    const xpToNextLevel = 300 - xpInCurrentLevel;
                    const levelProgress = (xpInCurrentLevel / 300) * 100;
                    
                    return (
                      <div className="space-y-1.5 pt-2 border-t border-primary/10">
                        {/* Level */}
                        <div className="bg-white/50 rounded px-2 py-1.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Trophy className="h-3 w-3 text-yellow-600" />
                              <span className="text-[10px] font-medium text-gray-600">{t('sidebar.level')}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{currentLevel}</span>
                          </div>
                          <Progress value={levelProgress} className="h-1" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-1.5">
                          {/* Total XP */}
                          <div className="flex flex-col bg-white/50 rounded px-2 py-1">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-blue-600" />
                              <span className="text-[10px] font-medium text-gray-600">{t('sidebar.totalXP')}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{totalXP}</span>
                          </div>
                          
                          {/* Streak */}
                          <div className="flex flex-col bg-white/50 rounded px-2 py-1">
                            <div className="flex items-center gap-1">
                              <Flame className="h-3 w-3 text-orange-600" />
                              <span className="text-[10px] font-medium text-gray-600">{t('sidebar.streak')}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{user.currentStreak || 0} 🔥</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            <SidebarGroup>
              <SidebarMenu>
                {navItems.map(item => {
                  const isActive = location === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className="h-10 transition-all font-normal"
                      >
                        <Link href={item.path}>
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>

            {isAdmin && (
              <>
                {!isCollapsed && (
                  <div className="px-4 py-2 mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-3 w-3 text-primary" />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {t('sidebar.adminPanel')}
                      </span>
                    </div>
                  </div>
                )}
                <SidebarGroup>
                  <SidebarMenu>
                    {adminItems.map(item => {
                      const isActive = location === item.path;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.label}
                            className={cn(
                              "h-9 transition-all font-normal",
                              isActive ? "bg-red-100 text-red-700 hover:bg-red-100 hover:text-red-700" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Link href={item.path}>
                              {item.icon}
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('sidebar.logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? APP_TITLE}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
