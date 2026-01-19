import { SignedIn, SignedOut, RedirectToSignIn, useAuth } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import UnitView from "./pages/UnitView";
import Chat from "./pages/Chat";
import Admin from "./pages/Admin";
import FeedbackManagement from "./pages/FeedbackManagement";
import Vocabulary from "./pages/Vocabulary";
import VocabularyQuizRedirect from "./pages/VocabularyQuizRedirect";
import VocabularyList from "./pages/VocabularyList";
import Progress from "./pages/Progress";
import Leaderboards from "./pages/Leaderboards";
import Feedback from "./pages/Feedback";
import SubscriptionAnalytics from "./pages/SubscriptionAnalytics";
import EmailTemplates from "./pages/EmailTemplates";
import PromptAdmin from "./pages/PromptAdmin";
import ChangelogAdmin from "./pages/ChangelogAdmin";
import OnboardingAdmin from "./pages/OnboardingAdmin";
import BackupManagement from "./pages/BackupManagement";
import ContentImportAdmin from "./pages/ContentImportAdmin";
import Changelog from "./pages/Changelog";
import SignInPage from "./pages/SignIn";
import SignUpPage from "./pages/SignUp";
import Units from "./pages/Units";
import WaitlistConfirm from "./pages/WaitlistConfirm";
import AdminWaitlist from "./pages/AdminWaitlist";
import Newsletter from "./pages/Newsletter";
import NewsletterUnsubscribe from "./pages/NewsletterUnsubscribe";
import NewsletterOptInConfirm from "./pages/NewsletterOptInConfirm";
import Profile from "./pages/Profile";
import Terms from "./pages/Terms";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import i18n from "./i18n";

// Protected route wrapper that requires authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  
  // Show loading while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

// Component wrapper for protected routes
function Protected({ Component }: { Component: React.ComponentType }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Component />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/terms" component={Terms} />
      <Route path="/waitlist/confirm" component={WaitlistConfirm} />
      <Route path="/newsletter/optin/confirm" component={NewsletterOptInConfirm} />
      <Route path="/newsletter/unsubscribe" component={NewsletterUnsubscribe} />
      {/* Clerk auth routes - use wildcard to catch all sub-routes like /sign-in/factor-one */}
      <Route path="/sign-in/:rest*" component={SignInPage} />
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up/:rest*" component={SignUpPage} />
      <Route path="/sign-up" component={SignUpPage} />
      
      {/* Protected routes */}
      <Route path="/dashboard">
        {() => <Protected Component={Dashboard} />}
      </Route>
      <Route path="/units">
        {() => <Protected Component={Units} />}
      </Route>
      <Route path="/unit/:unitNumber">
        {() => <Protected Component={UnitView} />}
      </Route>
      <Route path="/chat">
        {() => <Protected Component={Chat} />}
      </Route>
      <Route path="/vocabulary">
        {() => <Protected Component={Vocabulary} />}
      </Route>
      <Route path="/vocabulary-quiz">
        {() => <Protected Component={VocabularyQuizRedirect} />}
      </Route>
      <Route path="/vocabulary-list">
        {() => <Protected Component={VocabularyList} />}
      </Route>
      <Route path="/progress">
        {() => <Protected Component={Progress} />}
      </Route>
      <Route path="/leaderboards">
        {() => <Protected Component={Leaderboards} />}
      </Route>
      <Route path="/profile">
        {() => <Protected Component={Profile} />}
      </Route>
      <Route path="/subscription">
        {() => <Protected Component={Profile} />}
      </Route>
      <Route path="/feedback">
        {() => <Protected Component={Feedback} />}
      </Route>
      
      {/* Admin routes - Specific routes must come before general /admin route */}
      <Route path="/admin/prompt">
        {() => <Protected Component={PromptAdmin} />}
      </Route>
      <Route path="/admin/changelog">
        {() => <Protected Component={ChangelogAdmin} />}
      </Route>
      <Route path="/admin/onboarding">
        {() => <Protected Component={OnboardingAdmin} />}
      </Route>
      <Route path="/admin/feedback">
        {() => <Protected Component={FeedbackManagement} />}
      </Route>
      <Route path="/admin/subscription-analytics">
        {() => <Protected Component={SubscriptionAnalytics} />}
      </Route>
      <Route path="/admin/email-templates">
        {() => <Protected Component={EmailTemplates} />}
      </Route>
      <Route path="/admin/backup">
        {() => <Protected Component={BackupManagement} />}
      </Route>
      <Route path="/admin/content-import">
        {() => <Protected Component={ContentImportAdmin} />}
      </Route>
      <Route path="/admin/waitlist">
        {() => <Protected Component={AdminWaitlist} />}
      </Route>
      <Route path="/admin/newsletter">
        {() => <Protected Component={Newsletter} />}
      </Route>
      <Route path="/admin">
        {() => <Protected Component={Admin} />}
      </Route>
      
      {/* Changelog - Protected with Sidebar */}
      <Route path="/changelog">
        {() => <Protected Component={Changelog} />}
      </Route>
      
      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // BETA: Force English for all users
  useEffect(() => {
    i18n.changeLanguage('en');
    localStorage.removeItem('preferredLanguage');
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <LanguageProvider defaultLanguage="en">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;