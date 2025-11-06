import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import WeekView from "./pages/WeekView";
import UnitView from "./pages/UnitView";
import Chat from "./pages/Chat";
import Admin from "./pages/Admin";
import FeedbackManagement from "./pages/FeedbackManagement";
import BetaRegistrations from "./pages/BetaRegistrations";
import Vocabulary from "./pages/Vocabulary";
import VocabularyList from "./pages/VocabularyList";
import Progress from "./pages/Progress";
import Feedback from "./pages/Feedback";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/week/:weekNumber"} component={WeekView} />
      <Route path={"/unit/:unitNumber"} component={UnitView} />
      <Route path={"/chat"} component={Chat} />
      <Route path="/vocabulary" component={Vocabulary} />
      <Route path="/vocabulary-list" component={VocabularyList} />
      <Route path={"/progress"} component={Progress} />
      <Route path={"/feedback"} component={Feedback} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/admin/feedback"} component={FeedbackManagement} />
      <Route path={"/admin/beta-registrations"} component={BetaRegistrations} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

