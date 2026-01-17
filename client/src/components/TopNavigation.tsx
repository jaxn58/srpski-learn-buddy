import { useMemo, useState } from "react";
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
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { APP_LOGO, APP_TITLE } from "@/const";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

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

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  isActive?: (location: string) => boolean;
};

export function TopNavigation() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const activeClass = "bg-[color:var(--accent)] text-white hover:brightness-95 hover:text-white";
  const myAvatar = useQuery(api.users.getMyPublicAvatarUrl, user ? {} : "skip");

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
            return (
              <Link key={item.href} href={item.href}>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-full p-1 hover:bg-accent/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-9 w-9 border">
                  {myAvatar?.url ? <AvatarImage src={myAvatar.url} alt="Your avatar" /> : null}
                  <AvatarFallback className="text-xs font-medium">
                    {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
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

