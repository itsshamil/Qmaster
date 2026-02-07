
import { TicketDisplay } from "@/components/queue/TicketDisplay";
import { QueueStats } from "@/components/queue/QueueStats";
import { QueueQR } from "@/components/queue/QueueQR";
import { QueueActions } from "@/components/queue/QueueActions";
import { QueueLineup } from "@/components/queue/QueueLineup";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, Sparkles } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { useServiceMetrics, useCancelToken, type Token } from "@/hooks/useQueue";
import { useQueueNotifications } from "@/hooks/useQueueNotifications";

export function DashboardActiveTicket({ activeToken }: { activeToken: Token }) {
    const navigate = useNavigate();
    const cancelToken = useCancelToken();
    const [cancelling, setCancelling] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);

    // Fetch live metrics for this service
    const { data: metrics } = useServiceMetrics(activeToken.service_id);

    // Calculate live predicted wait using same method as QueueLineup
    let predictedWait = activeToken.estimated_wait; // default to static
    if (metrics && activeToken.queue_position) {
        // Use same calculation as QueueLineup: position × avg_time_per_person
        const avgTimePerPerson = metrics.waiting_count > 0
            ? Math.ceil(metrics.predicted_wait_mins / metrics.waiting_count)
            : metrics.avg_service_time_recent || 5; // Default to 5 minutes per person
        predictedWait = Math.ceil(activeToken.queue_position * avgTimePerPerson);
    }

    // Trigger Notifications based on live data
    const { sentiment } = useQueueNotifications({
        tokenId: activeToken.id,
        queuePosition: activeToken.queue_position,
        estimatedWaitMins: predictedWait,
        status: activeToken.status
    });

    const handleCancel = () => setShowCancelDialog(true);

    const performCancel = async () => {
        setCancelling(true);
        try {
            await cancelToken.mutateAsync(activeToken.id);
            toast.success("Token cancelled");
        } catch {
            toast.error("Failed to cancel");
        } finally {
            setCancelling(false);
        }
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'My Queue Ticket',
                url: `${window.location.origin}/queue/${activeToken.id}`,
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(`${window.location.origin}/queue/${activeToken.id}`);
            toast.success("Link copied");
        }
    };

    // Sentiment Banner Styling
    const getBanner = () => {
        switch (sentiment) {
            case 'next': return { bg: 'bg-green-100', text: 'text-green-800', msg: "You're Next! Head to counter." };
            case 'urgent': return { bg: 'bg-orange-100', text: 'text-orange-800', msg: "Get Ready! Less than 10 mins." };
            case 'close': return { bg: 'bg-blue-50', text: 'text-blue-800', msg: "You're getting closer." };
            default: return null;
        }
    };
    const banner = getBanner();

    return (
        <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-600 font-bold uppercase tracking-wider text-xs">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                    </span>
                    Your Active Ticket
                </div>
                {metrics && (
                    <div className="flex items-center gap-1.5 text-[10px] text-purple-600 font-bold bg-purple-50/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-purple-100 shadow-sm">
                        <Sparkles className="h-3 w-3" />
                        AI Prediction
                    </div>
                )}
            </div>

            <Card className="relative overflow-hidden border border-white/40 shadow-xl backdrop-blur-md bg-white/80 rounded-2xl md:rounded-3xl p-0">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-48 h-48 rounded-full bg-gradient-to-br from-blue-400/10 to-purple-400/10 blur-3xl" />
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-48 h-48 rounded-full bg-gradient-to-tr from-cyan-400/10 to-blue-400/10 blur-3xl" />

                <div className={`h-1.5 w-full bg-gradient-to-r ${activeToken.status === 'cancelled' ? "from-red-500 to-orange-500" :
                    activeToken.status === 'completed' ? "from-green-500 to-emerald-500" :
                        activeToken.status === 'serving' ? "from-green-400 to-blue-500 animate-pulse" :
                            "from-blue-600 via-purple-500 to-pink-500 animate-gradient-x"
                    }`} />

                <div className="p-5 md:p-7 relative z-10">
                    {banner && banner.msg && (activeToken.status === 'waiting' || activeToken.status === 'serving') && (
                        <div className={`mb-6 p-4 rounded-2xl ${banner.bg} border border-white/50 shadow-sm animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-3`}>
                            <div className={`h-8 w-8 rounded-full ${banner.bg.replace('100', '200')} flex items-center justify-center`}>
                                <Clock className={`h-4 w-4 ${banner.text}`} />
                            </div>
                            <div className={`${banner.text} font-bold text-sm md:text-base`}>
                                {banner.msg}
                            </div>
                        </div>
                    )}

                    <div className="bg-white/60 rounded-2xl p-4 shadow-inner border border-white/50 mb-6">
                        <TicketDisplay
                            token={activeToken}
                            initialServiceName={activeToken.services?.name}
                            position={activeToken.queue_position}
                        />
                    </div>

                    {/* Override waiting time with LIVE prediction */}
                    <QueueStats
                        status={activeToken.status}
                        position={activeToken.queue_position}
                        estimatedWait={predictedWait}
                    />

                    {(activeToken.status === 'waiting' || activeToken.status === 'serving') && (
                        <div className="mt-8">
                            <QueueLineup currentToken={activeToken} />
                        </div>
                    )}

                    {(activeToken.status === 'waiting' || activeToken.status === 'serving') && (
                        <div className="mt-8 flex justify-center">
                            <div className="bg-white p-3 rounded-xl shadow-sm border border-neutral-100">
                                <QueueQR url={`${window.location.origin}/queue/${activeToken.id}`} />
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-neutral-100/50">
                        <QueueActions
                            status={activeToken.status}
                            cancelling={cancelling}
                            onShare={handleShare}
                            onCancel={handleCancel}
                        />

                        <ConfirmDialog
                            open={showCancelDialog}
                            onOpenChange={setShowCancelDialog}
                            title="Cancel Ticket?"
                            description="Are you sure you want to leave the queue? You will lose your spot."
                            confirmLabel="Yes, Leave Queue"
                            cancelLabel="No, Keep My Spot"
                            onConfirm={performCancel}
                        />

                        <div className="mt-4 flex justify-center">
                            <Button variant="ghost" className="text-neutral-400 hover:text-blue-600 text-xs gap-1" onClick={() => navigate(`/queue/${activeToken.id}`)}>
                                View Full Details <Sparkles className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="bg-white/60 backdrop-blur-md rounded-xl p-3 mt-4 border border-white/40 shadow-sm mx-4">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(activeToken.created_at), "h:mm a")}</span>
                    </div>
                    <div className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded">
                        #{activeToken.id.slice(0, 6)}
                    </div>
                </div>
            </div>
        </div>
    );
}
