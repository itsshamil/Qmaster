import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";

import { Clock, Users, ArrowRight, LayoutGrid, LogIn, CheckCircle, Home, User, Ticket, MapPin, Loader } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useServices, useCreateToken, useActiveToken, useQueueRealtime, type Service, useCancelToken, useTokens, useStaff } from "@/hooks/useQueue";
import { useGeolocation } from "@/hooks/useGeolocation";
import { checkGeofence } from "@/lib/geolocation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { TicketDisplay } from "@/components/queue/TicketDisplay";
import { QueueStats } from "@/components/queue/QueueStats";
import { QueueQR } from "@/components/queue/QueueQR";
import { QueueActions } from "@/components/queue/QueueActions";

import { QueueLineup } from "@/components/queue/QueueLineup";
import ConfirmDialog from "@/components/ui/confirm-dialog";

import { ServiceCard } from "@/components/queue/ServiceCard";
import { DashboardActiveTicket } from "@/components/queue/DashboardActiveTicket";

export default function ServiceSelection() {
  const { data: services, isLoading } = useServices();
  const { data: activeToken, isLoading: isLoadingToken } = useActiveToken();
  const { data: allTokens } = useTokens();
  const { data: staffList } = useStaff();
  const { user } = useAuth();
  const { location, loading: geoLoading, error: geoError, requestLocation, checkGeofence: checkGeofenceHook } = useGeolocation();
  const createToken = useCreateToken();
  const cancelToken = useCancelToken();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [time, setTime] = useState(new Date());
  const [geofenceChecking, setGeofenceChecking] = useState<string | null>(null);
  const [geofenceStatus, setGeofenceStatus] = useState<Record<string, { withinRadius: boolean; distance: number }>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Calculate queue statistics per service
  // Precompute token maps to avoid repeatedly filtering the same arrays
  const {
    tokensByService,
    tokensByStatus,
    todaysCounts,
    hasServing,
  } = useMemo(() => {
    const byService: Record<string, any[]> = {};
    const byStatus: Record<string, any[]> = {};
    const todays: Record<string, number> = {};
    let serving = false;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    (allTokens || []).forEach((t) => {
      // group by service
      if (!byService[t.service_id]) byService[t.service_id] = [];
      byService[t.service_id].push(t);

      // group by status
      if (!byStatus[t.status]) byStatus[t.status] = [];
      byStatus[t.status].push(t);

      if (t.status === 'serving') serving = true;

      // count today's tokens per service
      if (t.created_at && new Date(t.created_at) >= startOfToday) {
        todays[t.service_id] = (todays[t.service_id] || 0) + 1;
      }
    });

    return { tokensByService: byService, tokensByStatus: byStatus, todaysCounts: todays, hasServing: serving };
  }, [allTokens]);

  const queueStats = useMemo(() => {
    if (!services) return {};
    const stats: Record<string, { waiting: number; estimatedWait: number }> = {};

    services.forEach((service) => {
      const svcTokens = tokensByService[service.id] || [];
      const waitingCount = svcTokens.filter((t) => t.status === 'waiting').length;
      const estimatedWait = waitingCount > 0 ? Math.ceil(waitingCount * service.avg_service_time / Math.max(1, 1)) : 0;
      stats[service.id] = { waiting: waitingCount, estimatedWait };
    });

    return stats;
  }, [services, tokensByService]);

  // staff counts per service (compute once)
  const staffCounts = useMemo(() => {
    const map: Record<string, number> = {};
    const byServiceAvailable: Record<string, number> = {};
    (staffList || []).forEach((st) => {
      if (st.is_available) byServiceAvailable[st.service_id] = (byServiceAvailable[st.service_id] || 0) + 1;
    });
    (services || []).forEach((s) => {
      map[s.id] = byServiceAvailable[s.id] || 0;
    });
    return map;
  }, [services, staffList]);

  // Realtime updates for active token
  useQueueRealtime(activeToken?.id);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  }).format(time);

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(time);

  const letters = ["A", "B", "C", "D", "E", "F"];
  const servingToken = tokensByStatus?.serving?.[0] || null;
  const sortedServices = useMemo(() => {
    if (!services) return [];
    const list = services.slice();
    list.sort((a, b) => {
      // Put active token's service first
      if (activeToken?.service_id === a.id) return -1;
      if (activeToken?.service_id === b.id) return 1;
      // Available (not paused) before paused
      const aPaused = Boolean((a as any).is_paused);
      const bPaused = Boolean((b as any).is_paused);
      if (aPaused !== bPaused) return aPaused ? 1 : -1;
      return 0;
    });
    return list;
  }, [services, activeToken]);

  const handleGetToken = async (service: Service) => {
    if (!user) {
      toast.error("Please sign in to get a token");
      navigate("/auth");
      return;
    }

    // Only block booking if the user currently has an active (waiting or serving) ticket
    if (activeToken && (activeToken.status === 'waiting' || activeToken.status === 'serving')) {
      toast.error("You already have an active ticket.");
      return;
    }

    // Geofencing Check - required if service has location configured
    if (service.location_lat && service.location_long && service.radius_meters) {
      setGeofenceChecking(service.id);

      try {
        // Force a fresh check with high accuracy if possible, but don't fail immediately
        // The hook (useGeolocation) handles the logic, but we want to ensure we catch "timeout" specifically
        const result = await checkGeofenceHook(
          { latitude: service.location_lat, longitude: service.location_long },
          service.radius_meters
        );

        if (!result) {
          // This usually means requestLocation threw an error that was caught inside checkGeofenceHook but returned null/default
          // But looking at useGeolocation, it returns a result object with error string if it fails.
          // Let's rely on the result.error if present.
          toast.error("Could not verify your location. Please check GPS settings.");
          setGeofenceChecking(null);
          return;
        }

        if (result.error) {
          toast.error(result.error);
          setGeofenceChecking(null);
          return;
        }

        setGeofenceStatus(prev => ({
          ...prev,
          [service.id]: { withinRadius: result.withinRadius, distance: result.distance }
        }));

        if (!result.withinRadius) {
          const distanceMeters = Math.round(result.distance * 1000);
          toast.error(
            `You are ${distanceMeters}m away. Minimum range: ${service.radius_meters}m`
          );
          setGeofenceChecking(null);
          return;
        }
      } catch (err) {
        // Ensure we catch any unhandled errors from the hook
        const message = err instanceof Error ? err.message : "Location check failed";
        console.error("Geofence error:", err);
        toast.error(message);
        setGeofenceChecking(null);
        return;
      } finally {
        setGeofenceChecking(null);
      }
    }

    // Check daily/session limit if configured on service
    const limit = (service as any).daily_limit as number | undefined;
    if (typeof limit === 'number' && limit > 0) {
      const todayCount = (todaysCounts && todaysCounts[service.id]) || 0;
      if (todayCount >= limit) {
        toast.error(`Daily limit reached for ${service.name} (${limit})`);
        return;
      }
    }

    setSelectedId(service.id);
    setRefreshing(true);
    try {
      const token = await createToken.mutateAsync({
        serviceId: service.id,
        userId: user.id,
      });
      toast.success("Ticket generated successfully!");
      setSelectedId(null);
      // brief delay so UI can show refresh animation and queries settle
      await new Promise((res) => setTimeout(res, 800));
      // Navigate to ticket view so user can see full ticket instantly
      if (token?.id) navigate(`/queue/${token.id}`);
    } catch (err: any) {
      const msg = err?.message || "Failed to get token. Please try again.";
      toast.error(msg);
    } finally {
      setSelectedId(null);
      setRefreshing(false);
    }
  };

  const handleCancel = () => {
    // open confirmation dialog
    if (!activeToken) return;
    setShowCancelDialog(true);
  };

  const performCancel = async () => {
    if (!activeToken) return;
    setCancelling(true);
    setRefreshing(true);
    try {
      await cancelToken.mutateAsync(activeToken.id);
      toast.success("Token cancelled successfully");
      await new Promise((res) => setTimeout(res, 600));
    } catch (e) {
      toast.error("Failed to cancel token");
    } finally {
      setCancelling(false);
      setRefreshing(false);
    }
  };

  const handleShare = () => {
    if (navigator.share && activeToken) {
      navigator.share({
        title: 'My Queue Ticket',
        text: `Track my queue status for ${activeToken.services?.name}`,
        url: `${window.location.origin}/queue/${activeToken.id}`,
      }).catch(console.error);
    } else {
      const url = activeToken ? `${window.location.origin}/queue/${activeToken.id}` : window.location.href;
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  const showLoading = isLoading || (user && isLoadingToken);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 md:pb-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-white">
      {refreshing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
            <div className="text-white font-medium">Refreshing...</div>
          </div>
        </div>
      )}
      {/* Top Header for Mobile */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Ticket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-neutral-900">QueueMaster</h1>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Clock className="h-3 w-3" />
                <span>{formattedTime}</span>
              </div>
            </div>
          </div>

          {user ? (
            <Link to="/profile" className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
              <User className="h-4 w-4 text-blue-600" />
            </Link>
          ) : (
            <Link to="/auth" className="h-9 w-9 rounded-full bg-neutral-100 flex items-center justify-center">
              <LogIn className="h-4 w-4 text-neutral-600" />
            </Link>
          )}
        </div>
      </header>

      {/* Desktop Header */}
      <nav className="hidden md:flex px-6 py-4 items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-neutral-900">Transparent Queue</h1>
            <p className="text-[10px] text-neutral-500 font-medium">Smart Queue Management</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <Clock className="h-4 w-4" />
            <span>{formattedTime}</span>
            <span className="text-neutral-400">•</span>
            <span>{formattedDate}</span>
          </div>
          {user ? (
            <Link to="/profile" className="text-sm font-medium text-neutral-600 hover:text-blue-600 transition-colors">
              My Profile
            </Link>
          ) : (
            <Link to="/auth" className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-blue-600 transition-colors">
              <LogIn className="h-4 w-4" /> Sign In
            </Link>
          )}
          <Link to="/staff/login" className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-blue-600 transition-colors">
            <LayoutGrid className="h-4 w-4" /> Staff
          </Link>
        </div>
      </nav>

      <main className="px-4 py-4 md:max-w-4xl md:mx-auto md:px-6 md:py-6">
        {/* Active Ticket View - Always show if present */}
        {showLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin h-10 w-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
            <p className="text-neutral-400 text-sm">Loading services...</p>
          </div>
        ) : (
          <>

            {activeToken && (
              <DashboardActiveTicket activeToken={activeToken} />
            )}

            {/* Currently Serving Token - Big Display */}


            {/* Services Grid - Always show */}
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-neutral-900">Select a Service</h2>
                <p className="text-neutral-500 text-sm mt-1">Get your ticket for quick service</p>
                {activeToken && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    <strong>Note:</strong> You have an active ticket. Cancel it first to book a different service.
                  </div>
                )}
              </div>


              {!services || services.length === 0 ? (
                <div className="py-10 text-center text-neutral-400">No services available at the moment.</div>
              ) : (
                <div className="space-y-5 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:space-y-0">
                  {sortedServices?.map((service, index) => {
                    const assignedLetter = letters[index % letters.length];
                    const isCurrentService = activeToken && activeToken.service_id === service.id;
                    const isOtherServiceWhileActive = activeToken && !isCurrentService;

                    return (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        activeToken={activeToken}
                        letter={assignedLetter}
                        staffCount={staffCounts[service.id] ?? 0}
                        geofenceStatus={geofenceStatus[service.id]}
                        geofenceChecking={geofenceChecking === service.id}
                        createTokenPending={createToken.isPending}
                        isSelected={selectedId === service.id}
                        onGetToken={handleGetToken}
                        onViewTicket={(id) => navigate(`/queue/${id}`)}
                        isOtherServiceWhileActive={!!isOtherServiceWhileActive}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-neutral-200 text-center">
          <p className="text-neutral-400 text-xs md:text-sm">
            © 2026 QueueMaster. Streamlining service experiences.
          </p>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-neutral-200 px-4 py-2.5 md:hidden z-50">
        <div className="flex items-center justify-around">
          <Link
            to="/"
            className="flex flex-col items-center gap-1 text-blue-600"
          >
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Home className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium">Home</span>
          </Link>

          <Link
            to="/history"
            className="flex flex-col items-center gap-1 text-neutral-500"
          >
            <div className="h-10 w-10 rounded-full bg-neutral-50 flex items-center justify-center">
              <Ticket className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium">History</span>
          </Link>

          {user ? (
            <Link
              to="/profile"
              className="flex flex-col items-center gap-1 text-neutral-500"
            >
              <div className="h-10 w-10 rounded-full bg-neutral-50 flex items-center justify-center">
                <User className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">Profile</span>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="flex flex-col items-center gap-1 text-neutral-500"
            >
              <div className="h-10 w-10 rounded-full bg-neutral-50 flex items-center justify-center">
                <LogIn className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">Sign In</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );

}


