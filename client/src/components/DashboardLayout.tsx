import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useMemo } from "react";
import { useQuery } from "convex/react";

import { TopNavigation } from "@/components/TopNavigation";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { FloatingChatButton } from "./FloatingChatButton";
import { useIsMobile } from "@/hooks/useMobile";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Database,
  Mail,
  MessageCircle,
  PanelLeft,
  Presentation,
  ScrollText,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";

type AdminNavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
};

function AdminSidebar() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const feedbackNewCount = useQuery(api.feedback.getNewCount);
  const inactiveUserCount = useQuery(api.users.getInactiveCount);
  const waitlistPendingCount = useQuery(api.waitlist.getPendingCount);

  const adminItems: AdminNavItem[] = useMemo(
    () => [
      { label: t("sidebar.userManagement"), path: "/admin", icon: <Users className="h-4 w-4" /> },
      { label: "Prompt Admin", path: "/admin/prompt", icon: <Sparkles className="h-4 w-4" /> },
      { label: "Changelog", path: "/admin/changelog", icon: <ScrollText className="h-4 w-4" /> },
      { label: "Onboarding", path: "/admin/onboarding", icon: <Presentation className="h-4 w-4" /> },
      { label: t("sidebar.feedback"), path: "/admin/feedback", icon: <MessageCircle className="h-4 w-4" /> },
      { label: t("sidebar.emailTemplates"), path: "/admin/email-templates", icon: <Mail className="h-4 w-4" /> },
      { label: "Newsletter", path: "/admin/newsletter", icon: <Send className="h-4 w-4" /> },
      { label: "Waitlist", path: "/admin/waitlist", icon: <Users className="h-4 w-4" /> },
      {
        label: t("sidebar.subscriptionAnalytics"),
        path: "/admin/subscription-analytics",
        icon: <TrendingUp className="h-4 w-4" />,
      },
      { label: "Database Backups", path: "/admin/backup", icon: <Database className="h-4 w-4" /> },
      { label: "Content Import", path: "/admin/content-import", icon: <Upload className="h-4 w-4" /> },
    ],
    [t]
  );

  const renderAdminCountBadge = (path: string) => {
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center">
        <div className="flex items-center gap-2 px-2 w-full">
          <Shield className="h-5 w-5 text-primary shrink-0" />
          {!isCollapsed && (
            <span className="font-semibold tracking-tight truncate">
              {t("sidebar.adminPanel")}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                className="ml-auto h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Toggle admin menu"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "Expand menu" : "Collapse menu"}
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.adminPanel")}</SidebarGroupLabel>
          <SidebarMenu>
            {adminItems.map((item) => {
              const isActive = location === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                    className={cn(
                      "h-9 transition-all font-normal",
                      isActive
                        ? "bg-red-100 text-red-700 hover:bg-red-100 hover:text-red-700"
                        : "text-muted-foreground hover:text-foreground"
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
      </SidebarContent>
    </Sidebar>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isAdminRoute = location === "/admin" || location.startsWith("/admin/");

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <>
      <SignedIn>
        {isAdmin && isAdminRoute && !isMobile ? (
          <SidebarProvider>
            <AdminSidebar />
            <SidebarInset className="bg-muted/20">
              <TopNavigation />
              <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pt-6">
                {children}
              </div>
            </SidebarInset>
            <FloatingChatButton />
          </SidebarProvider>
        ) : (
          <div className="min-h-screen bg-muted/20">
            <TopNavigation />
            <main className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pt-6">
              {children}
            </main>
            <FloatingChatButton />
          </div>
        )}
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
