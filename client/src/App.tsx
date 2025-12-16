import { SignedIn, SignedOut, RedirectToSignIn, useAuth } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import WeekView from "./pages/WeekView";
import UnitView from "./pages/UnitView";
import Chat from "./pages/Chat";
import Admin from "./pages/Admin";
import FeedbackManagement from "./pages/FeedbackManagement";
import Vocabulary from "./pages/Vocabulary";
import VocabularyQuizRedirect from "./pages/VocabularyQuizRedirect";
import VocabularyList from "./pages/VocabularyList";
import Progress from "./pages/Progress";
import Feedback from "./pages/Feedback";
import MySubscription from "./pages/MySubscription";
import SubscriptionAnalytics from "./pages/SubscriptionAnalytics";
import EmailTemplates from "./pages/EmailTemplates";
import PromptAdmin from "./pages/PromptAdmin";
import SignInPage from "./pages/SignIn";
import SignUpPage from "./pages/SignUp";
import Units from "./pages/Units";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import i18n from "./i18n";

// Protected route wrapper that requires authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  
  // #region agent log
  useEffect(() => {
    const logData = {location:'App.tsx:36',message:'ProtectedRoute render',data:{isLoaded,currentPath:window.location.pathname,clerkReady:!!(window as any).Clerk},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C'};
    console.log('[DEBUG]', logData);
    fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
  }, [isLoaded]);
  // #endregion
  
  // Show loading while Clerk is initializing
  if (!isLoaded) {
    // #region agent log
    const logData = {location:'App.tsx:44',message:'Clerk not loaded yet',data:{currentPath:window.location.pathname},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'};
    console.log('[DEBUG]', logData);
    fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    // #endregion
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // #region agent log
  const logData = {location:'App.tsx:53',message:'Clerk loaded, rendering children',data:{currentPath:window.location.pathname},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C'};
  console.log('[DEBUG]', logData);
  fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
  // #endregion
  
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
      <Component />
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
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
      <Route path="/week/:weekNumber">
        {() => <Protected Component={WeekView} />}
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
      <Route path="/subscription">
        {() => <Protected Component={MySubscription} />}
      </Route>
      <Route path="/feedback">
        {() => <Protected Component={Feedback} />}
      </Route>
      
      {/* Admin routes */}
      <Route path="/admin">
        {() => <Protected Component={Admin} />}
      </Route>
      <Route path="/admin/prompt">
        {() => <Protected Component={PromptAdmin} />}
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
  }, []); // Remove user dependency

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
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
