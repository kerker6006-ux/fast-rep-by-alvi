import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ActivePageProvider } from "@/contexts/ActivePageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import Welcome from "./pages/Welcome.tsx";

// Lazy-load every route so the initial bundle stays tiny.
const Landing = lazy(() => import("./pages/Landing.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));
const Privacy = lazy(() => import("./pages/Legal.tsx").then(m => ({ default: m.Privacy })));
const Terms = lazy(() => import("./pages/Legal.tsx").then(m => ({ default: m.Terms })));
const DataDeletion = lazy(() => import("./pages/Legal.tsx").then(m => ({ default: m.DataDeletion })));
const DataDeletionStatus = lazy(() => import("./pages/DataDeletionStatus.tsx"));
const ReviewerGuide = lazy(() => import("./pages/ReviewerGuide.tsx"));

const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Index = lazy(() => import("./pages/Index.tsx"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite.tsx"));

// Admin chunks load only when the admin area is visited.
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminRecharges = lazy(() => import("./pages/admin/AdminRecharges"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminPricing = lazy(() => import("./pages/admin/AdminPricing"));
const AdminFbPages = lazy(() => import("./pages/admin/AdminFbPages"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ActivePageProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/welcome" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />

                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                  <Route index element={<AdminOverview />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="recharges" element={<AdminRecharges />} />
                  <Route path="payments" element={<AdminPayments />} />
                  <Route path="pricing" element={<AdminPricing />} />
                  <Route path="fb-pages" element={<AdminFbPages />} />
                  <Route path="announcements" element={<AdminAnnouncements />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Route>
                <Route path="/" element={<Landing />} />
                <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/data-deletion" element={<DataDeletion />} />
                <Route path="/data-deletion-status" element={<DataDeletionStatus />} />
                <Route path="/reviewer-guide" element={<ReviewerGuide />} />
                <Route path="/accept-invite" element={<AcceptInvite />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ActivePageProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
