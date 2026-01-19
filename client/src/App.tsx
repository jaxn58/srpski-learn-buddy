import { RedirectToSignIn, SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch } from "wouter";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import i18n from "./i18n";

// Route-based code splitting: keep the initial bundle small and load pages on demand.
const Home = lazy(() => import("./pages/Home"));
const Terms = lazy(() => import("./pages/Terms"));
const WaitlistConfirm = lazy(() => import("./pages/WaitlistConfirm"));
const NewsletterOptInConfirm = lazy(() => import("./pages/NewsletterOptInConfirm"));
const NewsletterUnsubscribe = lazy(() => import("./pages/NewsletterUnsubscribe"));
const SignInPage = lazy(() => import("./pages/SignIn"));
const SignUpPage = lazy(() => import("./pages/SignUp"));

// Protected pages + layout
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Units = lazy(() => import("./pages/Units"));
const UnitView = lazy(() => import("./pages/UnitView"));
const Chat = lazy(() => import("./pages/Chat"));
const Vocabulary = lazy(() => import("./pages/Vocabulary"));
const VocabularyQuizRedirect = lazy(() => import("./pages/VocabularyQuizRedirect"));
const VocabularyList = lazy(() => import("./pages/VocabularyList"));
const Progress = lazy(() => import("./pages/Progress"));
const Leaderboards = lazy(() => import("./pages/Leaderboards"));
const Profile = lazy(() => import("./pages/Profile"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Changelog = lazy(() => import("./pages/Changelog"));

// Admin pages
const Admin = lazy(() => import("./pages/Admin"));
const PromptAdmin = lazy(() => import("./pages/PromptAdmin"));
const ChangelogAdmin = lazy(() => import("./pages/ChangelogAdmin"));
const OnboardingAdmin = lazy(() => import("./pages/OnboardingAdmin"));
const FeedbackManagement = lazy(() => import("./pages/FeedbackManagement"));
const SubscriptionAnalytics = lazy(() => import("./pages/SubscriptionAnalytics"));
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));
const BackupManagement = lazy(() => import("./pages/BackupManagement"));
const ContentImportAdmin = lazy(() => import("./pages/ContentImportAdmin"));
const AdminWaitlist = lazy(() => import("./pages/AdminWaitlist"));
const Newsletter = lazy(() => import("./pages/Newsletter"));

// 404
const NotFound = lazy(() => import("./pages/NotFound"));

function FullPageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Protected route wrapper that requires authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  
  // Show loading while Clerk is initializing
  if (!isLoaded) {
    return <FullPageLoader />;
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

function Router() {
  return (
    <Suspense fallback={<FullPageLoader />}>
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
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/units">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Units />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/unit/:unitNumber">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <UnitView />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/chat">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Chat />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/vocabulary">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Vocabulary />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/vocabulary-quiz">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <VocabularyQuizRedirect />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/vocabulary-list">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <VocabularyList />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/progress">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Progress />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/leaderboards">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Leaderboards />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/profile">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Profile />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/subscription">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Profile />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/feedback">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Feedback />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>

        {/* Admin routes - Specific routes must come before general /admin route */}
        <Route path="/admin/prompt">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <PromptAdmin />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/changelog">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <ChangelogAdmin />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/onboarding">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <OnboardingAdmin />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/feedback">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <FeedbackManagement />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/subscription-analytics">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <SubscriptionAnalytics />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/email-templates">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <EmailTemplates />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/backup">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <BackupManagement />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/content-import">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <ContentImportAdmin />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/waitlist">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <AdminWaitlist />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/newsletter">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Newsletter />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Admin />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>

        {/* Changelog - Protected with Sidebar */}
        <Route path="/changelog">
          {() => (
            <ProtectedRoute>
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <DashboardLayout>
                  <Changelog />
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          )}
        </Route>

        {/* 404 */}
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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