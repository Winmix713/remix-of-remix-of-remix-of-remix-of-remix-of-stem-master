import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/lib/i18n";

// Pages
import Auth from "./pages/Auth";
import Library from "./pages/Library";
import Upload from "./pages/Upload";
import Configure from "./pages/Configure";
import Edit from "./pages/Edit";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Auth route */}
          <Route path="/auth" element={<Auth />} />
          
          {/* Protected routes - authentication required */}
          <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
          <Route path="/configure/:id" element={<ProtectedRoute><Configure /></ProtectedRoute>} />
          <Route path="/edit/:id" element={<ProtectedRoute><Edit /></ProtectedRoute>} />
          
          {/* Redirect root to library */}
          <Route path="/" element={<Navigate to="/library" replace />} />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;