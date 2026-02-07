import { useEffect, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";

import { ArrowLeft, Clock, CheckCircle } from "lucide-react";

import { useToken, useQueueRealtime, useServiceMetrics } from "@/hooks/useQueue";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MobileTimerBar from "@/components/MobileTimerBar";
import MobileNav from "@/components/MobileNav";
import { TicketDisplay } from "@/components/queue/TicketDisplay";
import { QueueStats } from "@/components/queue/QueueStats";
import { QueueQR } from "@/components/queue/QueueQR";
import { QueueActions } from "@/components/queue/QueueActions";
import { QueueLineup } from "@/components/queue/QueueLineup";

import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export default function QueueStatus() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const navigate = useNavigate();
  // Use the custom hook that includes all necessary fields including queue_position
  const { data: token, isLoading, refetch } = useToken(tokenId!);
  const location = useLocation();
  // Get initial service data from navigation state if available to avoid loading flash
  const initialService = location.state?.service;
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [time, setTime] = useState(new Date());

  // Realtime updates - call hook at top level
  useQueueRealtime(tokenId!);

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
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(time);

  // Enforce that only authenticated owners can view their ticket on the client
  useEffect(() => {
    const checkOwner = async () => {
      const { data: { user } } = await supabase.auth.getSession();
      if (!user) {
        // Not signed in — redirect to auth with backlink
        navigate('/auth', { replace: true, state: { from: window.location.pathname } });
        return;
      }
      if (token && token.customer_id && token.customer_id !== user.id) {
        // Not authorized to view this ticket
        toast.error('You are not authorized to view this ticket');
        navigate('/', { replace: true });
      }
    };
    checkOwner();
  }, [token, navigate]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'My Queue Ticket',
        text: `Track my queue status for ${token?.services?.name}`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    }
  };

  const handleCancel = () => {
    if (!token) return;
    setShowCancelDialog(true);
  };

  const performCancel = async () => {
    if (!token) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('tokens')
        .update({ status: 'cancelled' })
        .eq('id', token.id);

      if (error) throw error;
      toast.success("Token cancelled successfully");
      refetch();
    } catch (e) {
      toast.error("Failed to cancel token");
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!token) return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
      <p className="text-neutral-500 mb-4">Token not found</p>
      <Link to="/">
        <Button>Return Home</Button>
      </Link>
    </div>
  );

  const isWaiting = token.status === "waiting";
  const isServing = token.status === "serving";
  const isCompleted = token.status === "completed";
  const isCancelled = token.status === "cancelled";

  // Use backend provided queue_position
  const position = token.queue_position;

  // Fetch live metrics for AI prediction
  const { data: metrics } = useServiceMetrics(token.service_id);

  // Calculate live predicted wait using same method as DashboardActiveTicket
  let predictedWait = token.estimated_wait; // default to static
  if (metrics && position) {
    const avgTimePerPerson = metrics.waiting_count > 0
      ? Math.ceil(metrics.predicted_wait_mins / metrics.waiting_count)
      : metrics.avg_service_time_recent || 5; // Default to 5 minutes per person
    predictedWait = Math.ceil(position * avgTimePerPerson);
  }

  return (
    <div className="min-h-screen bg-neutral-50 font-sans pb-28 md:pb-0 flex flex-col items-center">
      {/* Navbar */}
      <nav className="w-full px-4 md:px-6 py-4 flex items-center bg-transparent max-w-md md:max-w-lg mx-auto z-10">
        <Link to="/" className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-blue-600 transition-colors bg-white/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-neutral-200/50">
          <ArrowLeft className="h-4 w-4" /> All Services
        </Link>
      </nav>

      <main className="flex-1 w-full max-w-md md:max-w-lg px-4 md:px-6 flex flex-col justify-center -mt-10">
        <Card className="relative overflow-hidden border-none shadow-2xl bg-white rounded-3xl p-0">
          {/* Gradient Top Bar */}
          <div className={`h-2 w-full bg-gradient-to-r ${isCancelled ? "from-red-500 to-orange-500" :
            isCompleted ? "from-green-500 to-emerald-500" :
              isServing ? "from-green-400 to-blue-500 animate-pulse" :
                "from-blue-600 to-purple-600"
            }`} />

          <TicketDisplay
            token={token}
            initialServiceName={initialService?.name}
            position={position}
          />

          <QueueStats
            status={token.status}
            position={position}
            estimatedWait={predictedWait} // Use live AI prediction
          />

          {(isWaiting || isServing) && (
            <QueueLineup currentToken={token} />
          )}

          {(isWaiting || isServing) && (
            <QueueQR url={window.location.href} />
          )}

          <QueueActions
            status={token.status}
            cancelling={cancelling}
            onShare={handleShare}
            onCancel={handleCancel}
          />
          <ConfirmDialog open={showCancelDialog} onOpenChange={setShowCancelDialog} title="Cancel your ticket?" description="Are you sure you want to leave the queue? This will cancel your current ticket." confirmLabel="Yes, cancel" cancelLabel="No" onConfirm={performCancel} />
        </Card>

        {/* Enhanced Ticket Footer */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 mt-6 border border-neutral-100">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-neutral-500">
              <Clock className="h-3.5 w-3.5" />
              <span>Created {format(new Date(token.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
            <div className="text-neutral-400 font-mono">
              ID: {token.id.slice(0, 8)}
            </div>
          </div>
          {token.started_at && (
            <div className="flex items-center gap-2 text-xs text-green-600 mt-2 pt-2 border-t border-neutral-100">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Started {format(new Date(token.started_at), "h:mm a")}</span>
            </div>
          )}
          {token.ended_at && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 mt-2 pt-2 border-t border-neutral-100">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Ended {format(new Date(token.ended_at), "h:mm a")}</span>
            </div>
          )}
        </div>
      </main>

      <MobileTimerBar time={formattedTime} date={formattedDate} />
    </div>
  );
}
