import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { APP_LOGO, APP_TITLE } from "@/const";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useTheme } from "@/contexts/ThemeContext";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  isActive?: (location: string) => boolean;
};

export function TopNavigation() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme, switchable } = useTheme();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isBetaTester = Boolean(user?.isBetaTester);
  const activeClass = "bg-[color:var(--accent)] text-white hover:brightness-95 hover:text-white";
  const myAvatar = useQuery(api.users.getMyPublicAvatarUrl, user ? {} : "skip");
  const stats = useQuery(api.progress.getDashboardStats, user ? undefined : "skip");
  // Protected layout already requires auth; mirror `/units` data access here.
  const dbModules = useQuery(api.modules.getAllModulesConsolidated);
  const dbUnitsEn = useQuery(api.units.getAllUnitsMetadata, { language: "en" });
  const XP_PER_LEVEL = 300;
  const totalXP = Math.floor(stats?.totalXP || 0);
  const currentLevel =
    typeof stats?.level === "number" && Number.isFinite(stats.level) ? stats.level : null;
  const xpIntoLevel = ((totalXP % XP_PER_LEVEL) + XP_PER_LEVEL) % XP_PER_LEVEL;
  const progressToNextRatio =
    currentLevel && XP_PER_LEVEL > 0 ? Math.min(1, Math.max(0, xpIntoLevel / XP_PER_LEVEL)) : 0;

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
    ],
    [t]
  );

  const modulesForQuickSwitch = useMemo(() => {
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
        label: t("sidebar.viewProgress"),
        href: "/progress",
        icon: <TrendingUp className="h-4 w-4" />,
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
    ],
    [t]
  );

  const adminItems: NavItem[] = useMemo(
    () => [
      { label: t("sidebar.userManagement"), href: "/admin", icon: <Users className="h-4 w-4" /> },
      { label: "Prompt Admin", href: "/admin/prompt", icon: <Sparkles className="h-4 w-4" /> },
      { label: "Changelog", href: "/admin/changelog", icon: <ScrollText className="h-4 w-4" /> },
      { label: "Onboarding", href: "/admin/onboarding", icon: <Presentation className="h-4 w-4" /> },
      { label: t("sidebar.feedback"), href: "/admin/feedback", icon: <MessageCircle className="h-4 w-4" /> },
      { label: t("sidebar.emailTemplates"), href: "/admin/email-templates", icon: <Mail className="h-4 w-4" /> },
      { label: "Newsletter", href: "/admin/newsletter", icon: <Send className="h-4 w-4" /> },
      { label: "Waitlist", href: "/admin/waitlist", icon: <Users className="h-4 w-4" /> },
      {
        label: t("sidebar.subscriptionAnalytics"),
        href: "/admin/subscription-analytics",
        icon: <TrendingUp className="h-4 w-4" />,
      },
      { label: "Database Backups", href: "/admin/backup", icon: <Database className="h-4 w-4" /> },
      { label: "Content Import", href: "/admin/content-import", icon: <Upload className="h-4 w-4" /> },
    ],
    [t]
  );

  const isItemActive = (item: NavItem) => {
    if (item.isActive) return item.isActive(location);
    return location === item.href;
  };

  const closeMobile = () => setMobileOpen(false);

  const isMoreActive = useMemo(() => {
    return moreItems.some((i) => (i.isActive ? i.isActive(location) : location === i.href));
  }, [moreItems, location]);

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
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <SheetHeader className="px-4 py-4 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <img
                    src={APP_LOGO}
                    className="h-7 w-7 rounded-md object-cover ring-1 ring-border"
                    alt="Logo"
                  />
                  <span className="font-semibold">{APP_TITLE}</span>
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-1 p-2">
                {mainItems.map((item) => {
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
                  More
                </div>
                {moreItems.map((item) => {
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
                    {adminItems.map((item) => {
                      const active =
                        location === item.href ||
                        (item.href === "/admin" && (location === "/admin" || location.startsWith("/admin/")));
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
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="flex items-center gap-2">
            <img
              src={APP_LOGO}
              className="h-8 w-8 rounded-md object-cover ring-1 ring-border"
              alt="Logo"
            />
            <span className="hidden sm:inline font-semibold tracking-tight">
              {APP_TITLE}
            </span>
          </Link>
        </div>

        <nav className="hidden md:flex flex-1 items-center justify-center gap-1">
          {mainItems.map((item) => {
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
                  <Popover open={unitsQuickSwitchOpen} onOpenChange={setUnitsQuickSwitchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "px-2",
                          unitsQuickSwitchOpen && "bg-accent text-accent-foreground"
                        )}
                        aria-label="Jump to unit"
                      >
                        <ChevronDown className="h-4 w-4 opacity-70" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-80 p-3">
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Jump to Unit</div>

                        {quickSwitchModulesWithUnits.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            No units available yet.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">Module</div>
                              <Select
                                value={selectedModuleSlug}
                                onValueChange={(v) => {
                                  setSelectedModuleSlug(v);
                                  setSelectedUnitNumber("");
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select module" />
                                </SelectTrigger>
                                <SelectContent>
                                  {quickSwitchModulesWithUnits.map((m) => (
                                    <SelectItem key={m.slug} value={m.slug}>
                                      {`Module ${m.number}: ${m.title || m.slug}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">Unit</div>
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
                                  <SelectValue placeholder="Select unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(unitsByModuleSlugForQuickSwitch[selectedModuleSlug] || []).map(
                                    (u) => {
                                      const locked =
                                        !isAdmin && isBetaTester && u.unitNumber > 1;
                                      return (
                                        <SelectItem
                                          key={u.unitNumber}
                                          value={String(u.unitNumber)}
                                          disabled={locked}
                                        >
                                          <span className="inline-flex items-center gap-2">
                                            <span>{`Unit ${u.unitNumber}`}</span>
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
                aria-label="More"
              >
                <span>More</span>
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {moreItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className="cursor-pointer">
                    {item.icon}
                    <span className="ml-2">{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2",
                    (location === "/admin" || location.startsWith("/admin/")) &&
                      activeClass
                  )}
                  aria-label="Admin menu"
                >
                  <Shield className="h-4 w-4" />
                  <span>{t("sidebar.adminPanel")}</span>
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {adminItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="cursor-pointer">
                      {item.icon}
                      <span className="ml-2">{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {/* Dark Mode Toggle - Visible */}
          {switchable && toggleTheme && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-full p-1 hover:bg-accent/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="relative h-11 w-11">
                  {currentLevel !== null && (
                    <svg
                      className="absolute inset-0"
                      viewBox="0 0 40 40"
                      aria-hidden="true"
                    >
                      {(() => {
                        const r = 16;
                        const c = 2 * Math.PI * r;
                        const dashOffset = c * (1 - progressToNextRatio);
                        return (
                          <g transform="translate(20,20) rotate(-90)">
                            <circle
                              r={r}
                              cx={0}
                              cy={0}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={4}
                              className="text-muted/35"
                            />
                            <circle
                              r={r}
                              cx={0}
                              cy={0}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={4}
                              strokeLinecap="round"
                              strokeDasharray={`${c} ${c}`}
                              strokeDashoffset={dashOffset}
                              className="text-[color:var(--brand-blue)] transition-[stroke-dashoffset] duration-700 ease-out"
                            />
                          </g>
                        );
                      })()}
                    </svg>
                  )}
                  <Avatar className="absolute inset-1 h-9 w-9 border bg-white">
                    {myAvatar?.url ? <AvatarImage src={myAvatar.url} alt="Your avatar" /> : null}
                    <AvatarFallback className="text-xs font-medium">
                      {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {currentLevel !== null && (
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[color:var(--brand-blue)] text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
                      {currentLevel}
                    </div>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>{t("sidebar.profile")}</span>
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
        </div>
      </div>
    </header>
  );
}

