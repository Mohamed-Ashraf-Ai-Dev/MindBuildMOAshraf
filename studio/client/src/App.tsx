/** MindBuild Studio design reminder: industrial-editorial dashboard, warm workshop palette, RTL first, focused build flow. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";

function App() {
  return <ErrorBoundary><TooltipProvider><Toaster richColors position="top-center" /><Home /></TooltipProvider></ErrorBoundary>;
}

export default App;
