import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { Link, Redirect, useLocation } from "wouter";
import { useMemo } from "react";
import { useQuery } from "convex/react";

import { TopNavigation } from "@/components/TopNavigation";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { FloatingChatButton } from "./FloatingChatButton";
import { ChatModal } from "./ChatModal";
import { BuddyModalProvider, useBuddyModal } from "@/contexts/BuddyModalContext";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Database,
  ListTodo,
  Mail,
  Megaphone,
  MessageCircle,
  PanelLeft,
  PanelRight,
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

type AdminGroup = {
  title: string;
  icon: React.ReactNode;
  items: AdminNavItem[];
};

function AdminSidebar() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const { state, toggleSidebar, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";

  const feedbackNewCount = useQuery(api.feedback.getNewCount);
  const inactiveUserCount = useQuery(api.users.getInactiveCount);
  const waitlistPendingCount = useQuery(api.waitlist.getPendingCount);

  const adminGroups: AdminGroup[] = useMemo(
    () => [
      {
        title: t("sidebar.userManagement"),
        icon: <Users className="h-4 w-4" />,
        items: [
          { label: t("sidebar.userManagement"), path: "/admin", icon: <Users className="h-4 w-4" /> },
          { label: t("sidebar.waitlist"), path: "/admin/waitlist", icon: <Users className="h-4 w-4" /> },
          { label: t("sidebar.onboarding"), path: "/admin/onboarding", icon: <Presentation className="h-4 w-4" /> },
          {
            label: t("sidebar.dashboardAnnouncements"),
            path: "/admin/dashboard-announcements",
            icon: <Megaphone className="h-4 w-4" />,
          },
          {
            label: t("sidebar.subscriptionAnalytics"),
            path: "/admin/subscription-analytics",
            icon: <TrendingUp className="h-4 w-4" />,
          },
        ],
      },
      {
        title: t("sidebar.communication"),
        icon: <Mail className="h-4 w-4" />,
        items: [
          { label: t("sidebar.emailTemplates"), path: "/admin/email-templates", icon: <Mail className="h-4 w-4" /> },
          { label: t("sidebar.newsletter"), path: "/admin/newsletter", icon: <Send className="h-4 w-4" /> },
          { label: t("sidebar.feedback"), path: "/admin/feedback", icon: <MessageCircle className="h-4 w-4" /> },
          { label: t("sidebar.wishlist"), path: "/admin/wishlist", icon: <ListTodo className="h-4 w-4" /> },
        ],
      },
      {
        title: t("sidebar.contentAndSystem"),
        icon: <Database className="h-4 w-4" />,
        items: [
          { label: t("sidebar.promptAdmin"), path: "/admin/prompt", icon: <Sparkles className="h-4 w-4" /> },
          { label: t("sidebar.chatAdmin", "Chat Admin"), path: "/admin/chat", icon: <MessageCircle className="h-4 w-4" /> },
          { label: t("sidebar.knowledgeBase", "Knowledge Base"), path: "/admin/knowledge", icon: <BookOpen className="h-4 w-4" /> },
          { label: t("sidebar.contentStudio"), path: "/admin/content-studio", icon: <Sparkles className="h-4 w-4" /> },
          { label: t("sidebar.changelog"), path: "/admin/changelog", icon: <ScrollText className="h-4 w-4" /> },
          { label: t("sidebar.databaseBackups"), path: "/admin/backup", icon: <Database className="h-4 w-4" /> },
        ],
      },
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
        aria-label={t("admin.pendingCountAria", { count: label })}
        title={`${label}`}
      >
        {label}
      </span>
    );
  };

  return (
    <Sidebar collapsible="icon" className="z-[60] border-r transition-all duration-300">
      <SidebarHeader className="h-16 flex items-center justify-center bg-background border-b">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebar}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          </TooltipContent>
        </Tooltip>
      </SidebarHeader>

      <SidebarContent className="gap-0 bg-background">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
            {t("sidebar.adminPanel")}
          </SidebarGroupLabel>
          <SidebarMenu>
            {adminGroups.map((group) => (
              <Collapsible
                key={group.title}
                asChild
                defaultOpen={group.items.some((item) => location === item.path)}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                      tooltip={group.title}
                      onClick={() => {
                        if (isCollapsed) {
                          setOpen(true);
                        }
                      }}
                    >
                      {group.icon}
                      <span>{group.title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {group.items.map((item) => {
                        const isActive = location === item.path;
                        return (
                          <SidebarMenuSubItem key={item.path}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive}
                              className={cn(
                                "h-9 transition-all font-normal",
                                isActive
                                  ? "bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground font-medium"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <Link href={item.path}>
                                {item.icon}
                                <span>{item.label}</span>
                                {renderAdminCountBadge(item.path)}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { isOpen: isBuddyOpen, prefillText, unitNumber: buddyUnitNumber, closeBuddyModal } = useBuddyModal();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isAdminRoute = location === "/admin" || location.startsWith("/admin/");
  const isChatRoute = location === "/chat" || location.startsWith("/chat/");

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (user && !isAdmin && user.isActive === false) {
    return <Redirect to="/account-inactive" />;
  }

  return (
    <>
      <SignedIn>
        {isAdmin && !isMobile ? (
          <SidebarProvider className={cn(isChatRoute && "h-svh overflow-hidden")}>
            <AdminSidebar />
            <SidebarInset className="bg-muted/20">
              <TopNavigation />
              <div
                className={cn(
                  "flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pt-6",
                  isChatRoute && "flex flex-col min-h-0 overflow-hidden pt-0"
                )}
              >
                {children}
              </div>
            </SidebarInset>
            {!isChatRoute && <FloatingChatButton />}
          </SidebarProvider>
        ) : (
          <div
            className={cn(
              "min-h-screen bg-muted/20",
              isChatRoute && "h-[100dvh] flex flex-col overflow-hidden"
            )}
          >
            {!(isChatRoute && isMobile) && <TopNavigation />}
            <main
              className={cn(
                "w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pt-6",
                isChatRoute && "flex-1 flex flex-col min-h-0 overflow-hidden pt-0",
                isChatRoute && isMobile && "p-0"
              )}
            >
              {children}
            </main>
            {!isChatRoute && <FloatingChatButton />}
          </div>
        )}
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>

      <ChatModal
        isOpen={isBuddyOpen}
        onClose={closeBuddyModal}
        prefillText={prefillText}
        unitNumber={buddyUnitNumber}
      />
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BuddyModalProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </BuddyModalProvider>
  );
}
