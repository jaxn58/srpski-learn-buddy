import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Brain,
  BookOpen,
  ChevronDown,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  MessageSquare,
  Shield,
  ScrollText,
  Send,
  Sparkles,
  Trophy,
  TrendingUp,
  Upload,
  UserCircle,
  Users,
  Layers,
  Presentation,
  Moon,
  Sun,
  Lock,
  ListTodo,
  ChevronRight,
  Library,
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { useFeatureAccess, canUseLearning, canUseBuddy, canUseKnowledgeRack, canUseChatLibrary } from "@/hooks/useFeatureAccess";
import { APP_LOGO, APP_TITLE } from "@/const";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { XP_PER_LEVEL } from "../../../convex/gamification";
import { useTheme } from "@/contexts/ThemeContext";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AvatarEnergyGauge,
  AvatarWithRings,
  useAvatarRingProps,
} from "@/components/AvatarProfileHover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  isActive?: (location: string) => boolean;
};

type DbModuleForQuickSwitch = {
  _id: unknown;
  slug?: string | null;
  moduleNumber?: number | null;
  titleEn?: string | null;
};

type DbUnitMetadataForQuickSwitch = {
  moduleMetadataId?: unknown;
  moduleId?: unknown;
  unitNumber?: number | string | null;
  title?: string | null;
};

type QuickSwitchModule = {
  slug: string;
  number: number;
  title: string;
  _id: unknown;
};

function MobileAdminGroup({ group, location, activeClass, closeMobile }: { 
  group: any, 
  location: string, 
  activeClass: string, 
  closeMobile: () => void 
}) {
  const [isOpen, setIsOpen] = useState(
    group.items.some((item: any) => 
      location === item.href || (item.href === "/admin" && (location === "/admin" || location.startsWith("/admin/")))
    )
  );

  return (
    <div className="space-y-1">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hover:text-foreground transition-colors"
      >
        <span>{group.title}</span>
        <ChevronRight className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90")} />
      </button>
      {isOpen && group.items.map((item: any) => {
        const active =
          location === item.href ||
          (item.href === "/admin" && (location === "/admin" || location.startsWith("/admin/")));
        return (
          <Link key={item.href} href={item.href} onClick={closeMobile}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2 pl-6",
                active && activeClass
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Button>
          </Link>
        );
      })}
    </div>
  );
}

export function TopNavigation() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme, switchable } = useTheme();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isBetaTester = Boolean(user?.isBetaTester);
  const featureAccess = useFeatureAccess();
  const showLearning = canUseLearning(featureAccess);
  const showBuddy = canUseBuddy(featureAccess);
  const showDocuments = canUseKnowledgeRack(featureAccess);
  const showChatLibrary = canUseChatLibrary(featureAccess);
  // Standalone Buddy (buddy tier): no learning features → the learning
  // dashboard is irrelevant, the chat is their home.
  const isBuddyOnly =
    featureAccess !== undefined &&
    !featureAccess.features.learning &&
    featureAccess.features.buddyChat;
  const activeClass = "bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground";
  const myAvatar = useQuery(api.users.getMyPublicAvatarUrl, user ? {} : "skip");
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const stats = useQuery(api.progress.getDashboardStats, user ? { todayStart } : "skip");
  const currentVersion = useQuery(api.versions.getCurrentVersion, { environment: "beta" });
  // Protected layout already requires auth; mirror `/units` data access here.
  const dbModules = useQuery(api.modules.getAllModulesConsolidated) as
    | DbModuleForQuickSwitch[]
    | undefined;
  const accessInfo = useQuery(api.subscriptions.getAccessibleUnits);
  const dbUnitsEn = useQuery(api.units.getAllUnitsMetadata, { language: "en" }) as
    | DbUnitMetadataForQuickSwitch[]
    | undefined;

  const totalXP = Math.floor(stats?.totalXP || 0);
  const currentLevel =
    typeof stats?.level === "number" && Number.isFinite(stats.level) ? stats.level : null;
  const xpIntoLevel = ((totalXP % XP_PER_LEVEL) + XP_PER_LEVEL) % XP_PER_LEVEL;
  const progressToNextRatio =
    currentLevel && XP_PER_LEVEL > 0 ? Math.min(1, Math.max(0, xpIntoLevel / XP_PER_LEVEL)) : 0;

  const avatarFallbackLabel = (user?.name || user?.email || "U").charAt(0).toUpperCase();
  const { avatarProps, energyGauge } = useAvatarRingProps({
    avatarUrl: myAvatar?.url,
    fallbackLabel: avatarFallbackLabel,
    showLearning,
    currentLevel,
    progressToNextRatio,
  });

  const mainItems: NavItem[] = useMemo(
    () => [
      {
        label: t("sidebar.dashboard"),
        href: "/dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        label: t("sidebar.units"),
        href: "/units",
        icon: <Layers className="h-4 w-4" />,
        isActive: (loc) => loc === "/units" || loc.startsWith("/unit/"),
      },
      {
        label: t("sidebar.practiceVocab"),
        href: "/vocabulary",
        icon: <BookOpen className="h-4 w-4" />,
      },
      {
        label: t("sidebar.aiLearnBuddy"),
        href: "/chat",
        icon: <Brain className="h-4 w-4" />,
      },
      {
        label: t("sidebar.myLibrary"),
        href: "/library",
        icon: <Library className="h-4 w-4" />,
        isActive: (loc) => loc === "/library" || loc.startsWith("/library/"),
      },
    ],
    [t]
  );

  const modulesForQuickSwitch = useMemo<QuickSwitchModule[]>(() => {
    if (!dbModules || dbModules.length === 0) return [];
    return dbModules
      .map((m) => ({
        slug: m.slug || "",
        number: m.moduleNumber || 0,
        title: m.titleEn || "",
        _id: m._id,
      }))
      .filter((m) => Boolean(m.slug))
      .sort((a, b) => a.number - b.number);
  }, [dbModules]);

  const unitsByModuleSlugForQuickSwitch = useMemo(() => {
    const result: Record<string, Array<{ unitNumber: number; title: string }>> = {};
    if (!dbUnitsEn || dbUnitsEn.length === 0) return result;

    const slugByModuleMetadataId = new Map<string, string>();
    for (const m of dbModules || []) {
      if (m?._id && m?.slug) slugByModuleMetadataId.set(String(m._id), String(m.slug));
    }

    for (const unit of dbUnitsEn) {
      let moduleSlug: string | undefined;
      if ((unit as any).moduleMetadataId) {
        moduleSlug = slugByModuleMetadataId.get(String((unit as any).moduleMetadataId));
      } else if ((unit as any).moduleId) {
        moduleSlug = String((unit as any).moduleId);
      }

      if (!moduleSlug) continue;
      if (!result[moduleSlug]) result[moduleSlug] = [];

      const unitNumber = Number((unit as any).unitNumber);
      if (!Number.isFinite(unitNumber)) continue;
      const exists = result[moduleSlug].some((u) => u.unitNumber === unitNumber);
      if (exists) continue;

      result[moduleSlug].push({
        unitNumber,
        title: String((unit as any).title || "").trim(),
      });
    }

    for (const slug of Object.keys(result)) {
      result[slug].sort((a, b) => a.unitNumber - b.unitNumber);
    }
    return result;
  }, [dbUnitsEn, dbModules]);

  const quickSwitchModulesWithUnits = useMemo(() => {
    return modulesForQuickSwitch.filter(
      (m) => (unitsByModuleSlugForQuickSwitch[m.slug] || []).length > 0
    );
  }, [modulesForQuickSwitch, unitsByModuleSlugForQuickSwitch]);

  const [unitsQuickSwitchOpen, setUnitsQuickSwitchOpen] = useState(false);
  const [selectedModuleSlug, setSelectedModuleSlug] = useState<string>("");
  const [selectedUnitNumber, setSelectedUnitNumber] = useState<string>("");

  const currentUnitNumberFromUrl = useMemo(() => {
    const m = String(location || "").match(/^\/unit\/(\d+)/);
    if (!m?.[1]) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }, [location]);

  const moduleSlugForCurrentUnit = useMemo(() => {
    if (!currentUnitNumberFromUrl) return null;
    for (const [slug, units] of Object.entries(unitsByModuleSlugForQuickSwitch)) {
      if (units.some((u) => u.unitNumber === currentUnitNumberFromUrl)) return slug;
    }
    return null;
  }, [currentUnitNumberFromUrl, unitsByModuleSlugForQuickSwitch]);

  useEffect(() => {
    if (!unitsQuickSwitchOpen) return;

    // Default module selection to current unit's module, otherwise first module with units.
    const fallbackSlug = quickSwitchModulesWithUnits[0]?.slug || "";
    const desired = moduleSlugForCurrentUnit || fallbackSlug;

    if (!selectedModuleSlug && desired) {
      setSelectedModuleSlug(desired);
      setSelectedUnitNumber("");
      return;
    }

    // If selected module has no units (data changed), reset to first available.
    if (selectedModuleSlug) {
      const hasUnits = (unitsByModuleSlugForQuickSwitch[selectedModuleSlug] || []).length > 0;
      if (!hasUnits && fallbackSlug) {
        setSelectedModuleSlug(fallbackSlug);
        setSelectedUnitNumber("");
      }
    }
  }, [
    unitsQuickSwitchOpen,
    selectedModuleSlug,
    moduleSlugForCurrentUnit,
    quickSwitchModulesWithUnits,
    unitsByModuleSlugForQuickSwitch,
  ]);

  const moreItems: NavItem[] = useMemo(
    () => [
      {
        label: t("sidebar.viewAllWords"),
        href: "/vocabulary-list",
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: t("sidebar.leaderboards"),
        href: "/leaderboards",
        icon: <Trophy className="h-4 w-4" />,
      },
      {
        label: t("sidebar.sendFeedback"),
        href: "/feedback",
        icon: <MessageSquare className="h-4 w-4" />,
      },
      {
        label: t("sidebar.wishlist"),
        href: "/wishlist",
        icon: <ListTodo className="h-4 w-4" />,
      },
    ],
    [t]
  );

  const adminGroups = useMemo(
    () => [
      {
        title: t("sidebar.userManagement"),
        icon: <Users className="h-4 w-4" />,
        items: [
          { label: t("sidebar.userManagement"), href: "/admin", icon: <Users className="h-4 w-4" /> },
          { label: t("sidebar.waitlist"), href: "/admin/waitlist", icon: <Users className="h-4 w-4" /> },
          { label: t("sidebar.onboarding"), href: "/admin/onboarding", icon: <Presentation className="h-4 w-4" /> },
          {
            label: t("sidebar.subscriptionAnalytics"),
            href: "/admin/subscription-analytics",
            icon: <TrendingUp className="h-4 w-4" />,
          },
        ],
      },
      {
        title: t("sidebar.communication"),
        icon: <Mail className="h-4 w-4" />,
        items: [
          { label: t("sidebar.emailTemplates"), href: "/admin/email-templates", icon: <Mail className="h-4 w-4" /> },
          { label: t("sidebar.newsletter"), href: "/admin/newsletter", icon: <Send className="h-4 w-4" /> },
          { label: t("sidebar.feedback"), href: "/admin/feedback", icon: <MessageCircle className="h-4 w-4" /> },
          { label: t("sidebar.wishlist"), href: "/admin/wishlist", icon: <ListTodo className="h-4 w-4" /> },
        ],
      },
      {
        title: t("sidebar.contentAndSystem"),
        icon: <Database className="h-4 w-4" />,
        items: [
          { label: t("sidebar.promptAdmin"), href: "/admin/prompt", icon: <Sparkles className="h-4 w-4" /> },
          { label: t("sidebar.chatAdmin", "Chat Admin"), href: "/admin/chat", icon: <MessageCircle className="h-4 w-4" /> },
          { label: t("sidebar.knowledgeBase", "Knowledge Base"), href: "/admin/knowledge", icon: <BookOpen className="h-4 w-4" /> },
          { label: t("sidebar.translationCoverage"), href: "/admin/translation-coverage", icon: <FileText className="h-4 w-4" /> },
          { label: t("sidebar.contentStudio"), href: "/admin/content-studio", icon: <Sparkles className="h-4 w-4" /> },
          { label: t("sidebar.changelog"), href: "/admin/changelog", icon: <ScrollText className="h-4 w-4" /> },
          { label: t("sidebar.databaseBackups"), href: "/admin/backup", icon: <Database className="h-4 w-4" /> },
        ],
      },
    ],
    [t]
  );

  // Feature gating (Phase 2): hard-hide entry points the user's plan does not
  // include. Learning items require the `learning` feature; the Buddy requires
  // `buddyChat` or the course `teaser`. Backend + route guards enforce too.
  const visibleMainItems = useMemo(
    () =>
      mainItems.filter((item) => {
        if (item.href === "/dashboard") return !isBuddyOnly;
        if (item.href === "/units" || item.href === "/vocabulary") return showLearning;
        if (item.href === "/chat") return showBuddy;
        if (item.href === "/library") return showChatLibrary;
        return true;
      }),
    [mainItems, showLearning, showBuddy, showChatLibrary, isBuddyOnly]
  );

  const visibleMoreItems = useMemo(
    () =>
      moreItems.filter((item) => {
        // Learning-only entries: hidden for standalone Buddy users.
        if (item.href === "/vocabulary-list" || item.href === "/leaderboards") return showLearning;
        return true;
      }),
    [moreItems, showLearning]
  );

  const isItemActive = (item: NavItem) => {
    if (item.isActive) return item.isActive(location);
    return location === item.href;
  };

  const closeMobile = () => setMobileOpen(false);

  const isMoreActive = useMemo(() => {
    return visibleMoreItems.some((i) => (i.isActive ? i.isActive(location) : location === i.href));
  }, [visibleMoreItems, location]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-muted/30 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t("topNav.openMenu")}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 flex flex-col">
              <SheetHeader className="px-4 py-4 pr-12 border-b shrink-0">
                <SheetTitle className="flex items-center gap-2">
                  <img
                    src={APP_LOGO}
                    className="h-7 w-7 rounded-md object-cover ring-1 ring-border"
                    alt="Logo"
                  />
                  <span className="text-sm font-semibold">{APP_TITLE}</span>
                </SheetTitle>
              </SheetHeader>

              <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
                {visibleMainItems.map((item) => {
                  const active = isItemActive(item);
                  return (
                    <Link key={item.href} href={item.href} onClick={closeMobile}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-2",
                          active && activeClass
                        )}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Button>
                    </Link>
                  );
                })}

                <div className="px-2 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("sidebar.more")}
                </div>
                {visibleMoreItems.map((item) => {
                  const active = isItemActive(item);
                  return (
                    <Link key={item.href} href={item.href} onClick={closeMobile}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-2",
                          active && activeClass
                        )}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Button>
                    </Link>
                  );
                })}

                {isAdmin && (
                  <>
                    <div className="px-2 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("sidebar.adminPanel")}
                    </div>
                    {adminGroups.map((group) => (
                      <MobileAdminGroup 
                        key={group.title} 
                        group={group} 
                        location={location} 
                        activeClass={activeClass} 
                        closeMobile={closeMobile} 
                      />
                    ))}
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center gap-2">
              <img
                src={APP_LOGO}
                className="h-8 w-8 rounded-md object-cover ring-1 ring-border"
                alt="Logo"
              />
            </Link>
            <div className="hidden sm:flex flex-col leading-none items-end">
              <Link href="/dashboard" className="font-semibold tracking-tight hover:opacity-80 transition-opacity">
                {APP_TITLE}
              </Link>
              {currentVersion?.version && (
                <Link
                  href="/changelog"
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors tabular-nums"
                >
                  v{currentVersion.version}
                </Link>
              )}
            </div>
          </div>
        </div>

        <nav className="hidden md:flex flex-1 items-center justify-center gap-1">
          {visibleMainItems.map((item) => {
            const active = isItemActive(item);
            const isUnitsItem = item.href === "/units";
            return (
              <div key={item.href} className={cn("flex items-center", isUnitsItem && "gap-0")}>
                <Link href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 px-3",
                      active && activeClass
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Button>
                </Link>

                {isUnitsItem && (
                  <Popover open={unitsQuickSwitchOpen} onOpenChange={(open) => {
                      setUnitsQuickSwitchOpen(open);
                      if (open) {
                        setSelectedUnitNumber("");
                      }
                    }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "px-2",
                          unitsQuickSwitchOpen && "bg-accent text-accent-foreground"
                        )}
                        aria-label={t("topNav.jumpToUnit")}
                      >
                        <ChevronDown className="h-4 w-4 opacity-70" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-80 p-3">
                      <div className="space-y-3">
                        <div className="text-sm font-medium">{t("topNav.unitsQuickSwitch.title")}</div>

                        {quickSwitchModulesWithUnits.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            {t("topNav.unitsQuickSwitch.noUnits")}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">{t("topNav.unitsQuickSwitch.moduleLabel")}</div>
                              <Select
                                value={selectedModuleSlug}
                                onValueChange={(v) => {
                                  setSelectedModuleSlug(v);
                                  setSelectedUnitNumber("");
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t("topNav.unitsQuickSwitch.selectModulePlaceholder")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {quickSwitchModulesWithUnits.map((m) => (
                                    <SelectItem key={m.slug} value={m.slug}>
                                      {`${t("units.module", { number: m.number })}: ${m.title || m.slug}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">{t("topNav.unitsQuickSwitch.unitLabel")}</div>
                              <Select
                                value={selectedUnitNumber}
                                onValueChange={(v) => {
                                  setSelectedUnitNumber(v);
                                  const n = Number(v);
                                  if (Number.isFinite(n)) {
                                    setUnitsQuickSwitchOpen(false);
                                    setLocation(`/unit/${n}`);
                                  }
                                }}
                                disabled={!selectedModuleSlug}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t("topNav.unitsQuickSwitch.selectUnitPlaceholder")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {(unitsByModuleSlugForQuickSwitch[selectedModuleSlug] || []).map(
                                    (u) => {
                                      const locked =
                                        !isAdmin && isBetaTester && u.unitNumber > (accessInfo?.maxUnits ?? 1);
                                      return (
                                        <SelectItem
                                          key={u.unitNumber}
                                          value={String(u.unitNumber)}
                                          disabled={locked}
                                        >
                                          <span className="inline-flex items-center gap-2">
                                            <span>{t("units.lesson", { number: u.unitNumber })}</span>
                                            {u.title ? (
                                              <span className="text-muted-foreground">
                                                — {u.title}
                                              </span>
                                            ) : null}
                                            {locked ? (
                                              <Lock className="h-3.5 w-3.5 opacity-60" />
                                            ) : null}
                                          </span>
                                        </SelectItem>
                                      );
                                    }
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            );
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-2 px-3",
                  isMoreActive && activeClass
                )}
                aria-label={t("sidebar.more")}
              >
                <span>{t("sidebar.more")}</span>
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {visibleMoreItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className="cursor-pointer">
                    {item.icon}
                    <span className="ml-2">{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center gap-2">
          {/* Dark Mode Toggle - Visible */}
          {switchable && toggleTheme && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
              aria-label={theme === "dark" ? t("topNav.theme.switchToLight") : t("topNav.theme.switchToDark")}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}
          
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-transparent p-0 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 data-[state=open]:bg-transparent data-[state=open]:ring-0"
                >
                  <AvatarWithRings {...avatarProps} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {showLearning && (
                  <DropdownMenuItem asChild>
                    <Link href="/progress" className="cursor-pointer">
                      <TrendingUp className="mr-2 h-4 w-4" />
                      <span>{t("sidebar.viewProgress")}</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>{t("sidebar.profile")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/changelog" className="cursor-pointer">
                    <ScrollText className="mr-2 h-4 w-4" />
                    <span>{t("sidebar.changelog")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("sidebar.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {energyGauge ? <AvatarEnergyGauge {...energyGauge} /> : null}
          </div>
        </div>
      </div>
    </header>
  );
}

