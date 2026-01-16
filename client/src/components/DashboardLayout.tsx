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
  UserCircle,
  MessageSquare,
  Sparkles,
  MessageCircle,
  Mail,
  Trophy,
  Star,
  Flame,
  Award,
  Shield,
  ScrollText,
  Presentation,
  Database,
  Send,
  CheckCircle2,
  Footprints,
  Flag,
  Zap,
  Upload
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { FloatingChatButton } from "./FloatingChatButton";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

// Badge helper functions (compact, readable, no random medal emojis)
type BadgeTone = "units" | "streak" | "xp" | "level" | "misc";
type BadgeMeta = { short: string; name: string; description: string; tone: BadgeTone };

const getBadgeMeta = (badgeId: string): BadgeMeta => {
  const metas: Record<string, BadgeMeta> = {
    first_steps: { short: "FS", name: "First Steps", description: "Complete your first exercise", tone: "units" },
    unit_complete: { short: "UC", name: "Unit Complete", description: "Finish your first unit", tone: "units" },
    five_units: { short: "U5", name: "Getting Started", description: "Complete 5 units", tone: "units" },
    ten_units: { short: "U10", name: "Serious Progress", description: "Complete 10 units", tone: "units" },

    streak_3: { short: "S3", name: "Streak Starter", description: "Maintain a 3-day streak", tone: "streak" },
    streak_7: { short: "S7", name: "Week Warrior", description: "Maintain a 7-day streak", tone: "streak" },
    streak_30: { short: "S30", name: "Unbreakable", description: "Maintain a 30-day streak", tone: "streak" },

    xp_100: { short: "XP1", name: "XP Collector", description: "Reach 100 XP", tone: "xp" },
    xp_500: { short: "XP5", name: "XP Grinder", description: "Reach 500 XP", tone: "xp" },
    xp_1000: { short: "XP10", name: "XP Legend", description: "Reach 1,000 XP", tone: "xp" },
    xp_2000: { short: "XP20", name: "XP Milestone", description: "Reach 2,000 XP", tone: "xp" },
    xp_5000: { short: "XP50", name: "XP Machine", description: "Reach 5,000 XP", tone: "xp" },
    xp_10000: { short: "XP100", name: "XP Beast", description: "Reach 10,000 XP", tone: "xp" },
    xp_20000: { short: "XP200", name: "XP Titan", description: "Reach 20,000 XP", tone: "xp" },
    xp_50000: { short: "XP500", name: "XP Mythic", description: "Reach 50,000 XP", tone: "xp" },

    level_5: { short: "L5", name: "Level 5", description: "Reach Level 5", tone: "level" },
    level_10: { short: "L10", name: "Level 10", description: "Reach Level 10", tone: "level" },
    level_15: { short: "L15", name: "Level 15", description: "Reach Level 15", tone: "level" },
    level_20: { short: "L20", name: "Level 20", description: "Reach Level 20", tone: "level" },
    level_25: { short: "L25", name: "Level 25", description: "Reach Level 25", tone: "level" },
  };

  return metas[badgeId] ?? { short: "★", name: "Achievement", description: "Unlocked achievement", tone: "misc" };
};

type BadgeIconComponent = React.ComponentType<{ className?: string }>;

const getBadgeIcon = (badgeId: string): BadgeIconComponent => {
  if (badgeId === "first_steps") return Footprints;
  if (badgeId === "unit_complete") return CheckCircle2;
  if (badgeId === "five_units") return Flag;
  if (badgeId === "ten_units") return Trophy;
  if (badgeId.startsWith("streak_")) return Flame;
  if (badgeId.startsWith("xp_")) return Zap;
  if (badgeId.startsWith("level_")) return Star;
  return Award;
};

const badgeToneClass = (tone: BadgeTone) => {
  if (tone === "units")
    return "bg-[color:var(--brand-blue-soft)] text-[color:var(--brand-blue-strong-text)] border-[color:var(--brand-blue-soft-border)]";
  if (tone === "streak") return "bg-red-50 text-red-700 border-red-200";
  if (tone === "xp") return "bg-amber-50 text-amber-800 border-amber-200";
  if (tone === "level") return "bg-purple-50 text-purple-700 border-purple-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
};

const badgeToneMiniEmblemClass = (tone: BadgeTone) => {
  // Mini emblem for the sidebar profile: recognisable icon > text code.
  if (tone === "units") return "bg-serbian-blue text-white border-white/15";
  if (tone === "streak") return "bg-serbian-red text-white border-white/15";
  if (tone === "xp") return "bg-gradient-to-br from-amber-400 to-amber-600 text-white border-white/20";
  if (tone === "level") return "bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-white/20";
  return "bg-gradient-to-br from-slate-500 to-slate-700 text-white border-white/15";
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

  // Admin sidebar badges (return 0 for non-admins on the backend)
  const feedbackNewCount = useQuery(api.feedback.getNewCount);
  const inactiveUserCount = useQuery(api.users.getInactiveCount);
  const waitlistPendingCount = useQuery(api.waitlist.getPendingCount);

  // Source of truth for displayed version: Convex appVersions (not package.json)
  const currentAppVersion = useQuery(api.versions.getCurrentVersion, { environment: "beta" });

  const displayedAppVersion = useMemo(() => {
    if (currentAppVersion && typeof currentAppVersion.version === "string") {
      return currentAppVersion.version;
    }
    // Fallback only if Convex is still loading or no version exists yet
    return typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0";
  }, [currentAppVersion]);

  const displayedReleaseChannel = useMemo(() => {
    const env = currentAppVersion?.environment ?? "beta";
    return env.charAt(0).toUpperCase() + env.slice(1);
  }, [currentAppVersion]);

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
    { label: t('sidebar.leaderboards'), path: "/leaderboards", icon: <Trophy className="h-5 w-5" /> },
    { label: t('sidebar.sendFeedback'), path: "/feedback", icon: <MessageSquare className="h-5 w-5" /> },
  ];

  const adminItems: NavItem[] = [
    { label: t('sidebar.userManagement'), path: "/admin", icon: <Users className="h-4 w-4" /> },
    { label: "Prompt Admin", path: "/admin/prompt", icon: <Sparkles className="h-4 w-4" /> },
    { label: "Changelog", path: "/admin/changelog", icon: <ScrollText className="h-4 w-4" /> },
    { label: "Onboarding", path: "/admin/onboarding", icon: <Presentation className="h-4 w-4" /> },
    { label: t('sidebar.feedback'), path: "/admin/feedback", icon: <MessageCircle className="h-4 w-4" /> },
    { label: t('sidebar.emailTemplates'), path: "/admin/email-templates", icon: <Mail className="h-4 w-4" /> },
    { label: "Newsletter", path: "/admin/newsletter", icon: <Send className="h-4 w-4" /> },
    { label: "Waitlist", path: "/admin/waitlist", icon: <Users className="h-4 w-4" /> },
    { label: t('sidebar.subscriptionAnalytics'), path: "/admin/subscription-analytics", icon: <TrendingUp className="h-4 w-4" /> },
    { label: "Database Backups", path: "/admin/backup", icon: <Database className="h-4 w-4" /> },
    { label: "Content Import", path: "/admin/content-import", icon: <Upload className="h-4 w-4" /> },
  ];

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const activeMenuItem = [...navItems, ...(isAdmin ? adminItems : [])].find(item => item.path === location);

  const renderAdminCountBadge = (path: string) => {
    if (!isAdmin) return null;
    const count =
      path === "/admin/feedback"
        ? (typeof feedbackNewCount === "number" ? feedbackNewCount : 0)
        : path === "/admin"
          ? (typeof inactiveUserCount === "number" ? inactiveUserCount : 0)
          : path === "/admin/waitlist"
            ? (typeof waitlistPendingCount === "number" ? waitlistPendingCount : 0)
            : 0;

    if (count <= 0) return null;
    const label = count > 99 ? "99+" : String(count);

    return (
      <span
        className={cn(
          "ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-semibold",
          "group-data-[collapsible=icon]:hidden"
        )}
        aria-label={`${label} pending`}
        title={`${label}`}
      >
        {label}
      </span>
    );
  };

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
                    {(() => {
                      const nickname = (user.publicNickname || "").trim();
                      const realName = (user.name || user.email || "").trim();
                      const title = nickname || realName || "—";

                      return (
                        <Link
                          href="/profile"
                          title={title}
                          aria-label={t("sidebar.profile")}
                          className="flex items-start justify-between gap-3 rounded-md px-1 py-1 hover:bg-accent/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {nickname || realName || "—"}
                            </div>
                            {nickname && realName && realName !== nickname && (
                              <div className="text-xs text-muted-foreground truncate">
                                {realName}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 inline-flex items-center gap-1 text-muted-foreground">
                            <UserCircle className="h-4 w-4" />
                            <span className="text-xs font-medium">{t("sidebar.profile")}</span>
                          </div>
                        </Link>
                      );
                    })()}
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
                      
                      {/* Compact Achievement Badges (show a few; tooltip shows details) */}
                      {(() => {
                        if (!userBadges || userBadges.length === 0) return null;
                        const sorted = [...userBadges].sort(
                          (a: any, b: any) => (b._creationTime ?? 0) - (a._creationTime ?? 0)
                        );
                        const visible = sorted.slice(0, 5);
                        const extra = Math.max(0, sorted.length - visible.length);
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {visible.map((badge: any, idx: number) => {
                              const meta = getBadgeMeta(badge.badgeId);
                              const Icon = getBadgeIcon(badge.badgeId);
                              return (
                                <Tooltip key={badge._id ?? `${badge.badgeId}-${idx}`}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "relative h-6 w-6 rounded-full border cursor-help shadow-sm hover:shadow transition-shadow flex items-center justify-center",
                                        badgeToneMiniEmblemClass(meta.tone)
                                      )}
                                    >
                                      <Icon className="h-3.5 w-3.5" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <div className="space-y-1">
                                      <p className="font-semibold">{meta.name}</p>
                                      <p className="text-xs text-gray-500">{meta.description}</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                            {extra > 0 && (
                              <div className="h-6 min-w-6 px-1.5 rounded-full border bg-slate-50 text-slate-700 text-[10px] font-semibold shadow-sm flex items-center justify-center">
                                +{extra}
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
                            <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-amber-500 text-white text-xs font-extrabold">
                              {currentLevel}
                            </span>
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
                            <span className="text-sm font-bold text-gray-900">{user.currentStreak || 0}</span>
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
                              {renderAdminCountBadge(item.path)}
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

          <SidebarFooter className="p-3 space-y-2">
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
            {/* Version Display */}
            {!isCollapsed && (
              <Link href="/changelog">
                <div className="px-2 py-1.5 text-center border-t pt-2 mt-2 hover:bg-accent/50 rounded-md transition-colors cursor-pointer">
                  <p className="text-[10px] text-muted-foreground font-mono hover:text-foreground transition-colors">
                    v{displayedAppVersion} {displayedReleaseChannel}
                  </p>
                  <p className="text-[9px] text-muted-foreground/70 mt-0.5">
                    View Changelog
                  </p>
                </div>
              </Link>
            )}
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
      <FloatingChatButton />
    </>
  );
}
