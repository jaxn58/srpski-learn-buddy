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
import Vocabulary from "./pages/Vocabulary";
import Progress from "./pages/Progress";
import Admin from "./pages/Admin";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/week/:weekNumber"} component={WeekView} />
      <Route path={"/unit/:unitNumber"} component={UnitView} />
      <Route path={"/chat"} component={Chat} />
      <Route path={"/vocabulary"} component={Vocabulary} />
      <Route path={"/progress"} component={Progress} />
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

