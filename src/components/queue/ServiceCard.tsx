
import { type Service, type Token, useServiceMetrics } from "@/hooks/useQueue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, Clock, ArrowRight, MapPin, Loader, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ServiceCardProps {
    service: Service;
    activeToken: Token | null | undefined;
    letter: string;
    staffCount: number;
    geofenceStatus: { withinRadius: boolean; distance: number } | undefined;
    geofenceChecking: boolean;
    createTokenPending: boolean;
    isSelected: boolean;
    onGetToken: (service: Service) => void;
    onViewTicket: (tokenId: string) => void;
    isOtherServiceWhileActive: boolean;
}

export function ServiceCard({
    service,
    activeToken,
    letter,
    staffCount,
    geofenceStatus,
    geofenceChecking,
    createTokenPending,
    isSelected,
    onGetToken,
    onViewTicket,
    isOtherServiceWhileActive,
}: ServiceCardProps) {
    const { data: metrics, isLoading: metricsLoading } = useServiceMetrics(service.id);

    const isAvailable = true; // Logic from parent was just 'true'
    const isCurrentService = activeToken && activeToken.service_id === service.id;
    const isPaused = (service as any).is_paused;

    // Use metrics if available, otherwise fallbacks (though metrics should load)
    const waitingCount = metrics ? metrics.waiting_count : 0;
    // If metrics loading, show spinner or old static calculation? 
    // We'll show a small loader or static if metrics are undefined.

    const predictedWait = metrics?.predicted_wait_mins;
    const shouldUsePrediction = metrics && metrics.avg_service_time_recent;

    return (
        <div className="w-full h-full">
            <Card className={`relative overflow-hidden border border-white/40 shadow-xl backdrop-blur-md bg-white/70 hover:bg-white/80 transition-all duration-300 rounded-2xl md:rounded-3xl h-full flex flex-col group ${isOtherServiceWhileActive ? 'opacity-60 grayscale-[0.5]' : 'hover:-translate-y-1 hover:shadow-2xl'}`}>

                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 rounded-full bg-gradient-to-tr from-cyan-400/20 to-blue-400/20 blur-2xl group-hover:scale-150 transition-transform duration-500" />

                <div className="p-6 md:p-7 flex flex-col flex-grow relative z-10">
                    <div className="flex justify-between items-start mb-5">
                        <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center text-2xl font-bold font-display transform group-hover:scale-110 transition-transform duration-300">
                            {letter}
                        </div>
                        {isAvailable && (
                            <span className="bg-green-500/10 text-green-700 border border-green-200/50 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
                                Available
                            </span>
                        )}
                    </div>

                    <div className="mb-5 flex-grow">
                        <h3 className="text-xl font-bold text-neutral-900 mb-2 group-hover:text-blue-700 transition-colors">
                            {service.name}
                        </h3>

                        {isPaused && (
                            <div className="mb-4 p-3 bg-yellow-500/10 text-yellow-800 text-sm rounded-xl border border-yellow-200/50 backdrop-blur-sm">
                                <div className="font-semibold flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                                    {(service as any).pause_comment ? 'Paused' : 'Service temporarily paused'}
                                </div>
                                {(service as any).pause_comment && <div className="text-xs mt-1 ml-3.5">{(service as any).pause_comment}</div>}
                            </div>
                        )}

                        <div className="flex flex-col gap-2.5 text-sm text-neutral-600">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-500">
                                    <Users className="h-3.5 w-3.5" />
                                </div>
                                <span>{staffCount} staff active</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-500">
                                    <Clock className="h-3.5 w-3.5" />
                                </div>
                                <span>~{service.avg_service_time} min / person</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 mb-5 bg-white/50 rounded-2xl p-2 border border-white/60">
                        <div className="text-center p-2 rounded-xl hover:bg-white/80 transition-colors">
                            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold mb-1">Waiting</div>
                            <div className="text-xl font-bold text-neutral-800">
                                {metrics ? waitingCount : '-'}
                            </div>
                        </div>
                        <div className="text-center p-2 rounded-xl hover:bg-white/80 transition-colors relative">
                            {shouldUsePrediction && (
                                <div className="absolute top-1 right-1">
                                    <Sparkles className="h-2 w-2 text-purple-500 animate-pulse" />
                                </div>
                            )}
                            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold mb-1">Wait</div>
                            <div className="text-xl font-bold text-blue-600">
                                {metrics ? predictedWait : '-'}
                                <span className="text-[10px] text-neutral-400 font-normal ml-0.5">m</span>
                            </div>
                        </div>
                        <div className="text-center p-2 rounded-xl hover:bg-white/80 transition-colors">
                            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold mb-1">Status</div>
                            <div className={`text-xs font-bold py-1 px-2 rounded-full inline-block ${isPaused
                                ? "text-yellow-700 bg-yellow-100"
                                : "text-green-700 bg-green-100"
                                }`}>
                                {isPaused ? "Paused" : "Open"}
                            </div>
                        </div>
                    </div>

                    {/* Location Status Badge */}
                    {service.location_lat && service.location_long && service.radius_meters && (
                        <div className="mb-5 flex items-center gap-2.5 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 text-xs backdrop-blur-sm">
                            <MapPin className={`h-4 w-4 flex-shrink-0 ${geofenceStatus?.withinRadius ? 'text-green-500' : 'text-blue-500'}`} />
                            {geofenceChecking ? (
                                <span className="flex items-center gap-1.5 text-blue-700 font-medium">
                                    <Loader className="h-3 w-3 animate-spin" />
                                    Locating you...
                                </span>
                            ) : geofenceStatus ? (
                                <span className={geofenceStatus.withinRadius ? "text-green-700 font-medium" : "text-orange-700 font-medium"}>
                                    {geofenceStatus.withinRadius
                                        ? `In Range (${(geofenceStatus.distance * 1000).toFixed(0)}m)`
                                        : `Too Far (${(geofenceStatus.distance * 1000).toFixed(0)}m)`}
                                </span>
                            ) : (
                                <span className="text-blue-700 font-medium">
                                    Location check required
                                </span>
                            )}
                        </div>
                    )}

                    {/* Daily Limit Progress */
                        (service as any).daily_limit > 0 && (
                            <div className="mb-4">
                                <div className="flex justify-between items-center text-xs mb-1.5 font-medium text-neutral-500">
                                    <span>Daily Capacity</span>
                                    <span className={`${(metrics?.waiting_count || 0) >= (service as any).daily_limit ? 'text-red-500' : 'text-blue-600'}`}>
                                        {Math.min(metrics?.waiting_count || 0, (service as any).daily_limit)} / {(service as any).daily_limit}
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/50">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${(metrics?.waiting_count || 0) >= (service as any).daily_limit
                                                ? 'bg-red-500'
                                                : 'bg-gradient-to-r from-blue-400 to-purple-500'
                                            }`}
                                        style={{
                                            width: `${Math.min(((metrics?.waiting_count || 0) / (service as any).daily_limit) * 100, 100)}%`
                                        }}
                                    />
                                </div>
                                {(metrics?.waiting_count || 0) >= (service as any).daily_limit && (
                                    <p className="text-[10px] text-red-500 mt-1 font-medium text-right">Limit Reached</p>
                                )}
                            </div>
                        )}

                    {isCurrentService ? (
                        <Button
                            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white h-12 font-bold shadow-lg shadow-green-500/20 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                            onClick={() => activeToken && onViewTicket(activeToken.id)}
                        >
                            <span className="flex items-center justify-between w-full px-2">
                                <span>View Your Ticket</span>
                                <div className="bg-white/20 p-1 rounded-lg">
                                    <ArrowRight className="h-4 w-4" />
                                </div>
                            </span>
                        </Button>
                    ) : (
                        <Button
                            className={`w-full h-12 font-bold shadow-lg rounded-xl transition-all duration-300 ${isOtherServiceWhileActive
                                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                : isPaused || ((service as any).daily_limit > 0 && (metrics?.waiting_count || 0) >= (service as any).daily_limit)
                                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98]'
                                }`}
                            onClick={() => {
                                if (isPaused) {
                                    const msg = (service as any).pause_comment ? (service as any).pause_comment : 'This service is temporarily paused';
                                    toast.error(msg);
                                    return;
                                }
                                if ((service as any).daily_limit > 0 && (metrics?.waiting_count || 0) >= (service as any).daily_limit) {
                                    toast.error("Daily limit reached for this service");
                                    return;
                                }
                                onGetToken(service);
                            }}
                            disabled={(createTokenPending && isSelected) || isPaused || isOtherServiceWhileActive || geofenceChecking || ((service as any).daily_limit > 0 && (metrics?.waiting_count || 0) >= (service as any).daily_limit)}
                        >
                            {createTokenPending && isSelected ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                    <span>Booking...</span>
                                </span>
                            ) : geofenceChecking ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader className="h-4 w-4 animate-spin" />
                                    <span>Verifying...</span>
                                </span>
                            ) : isOtherServiceWhileActive ? (
                                "Previous Ticket Active"
                            ) : isPaused ? (
                                "Temporarily Closed"
                            ) : ((service as any).daily_limit > 0 && (metrics?.waiting_count || 0) >= (service as any).daily_limit) ? (
                                "Daily Limit Reached"
                            ) : (
                                <span className="flex items-center justify-between w-full px-2">
                                    <span>Get Ticket</span>
                                    <div className="bg-white/20 p-1 rounded-lg transition-transform group-hover:translate-x-1">
                                        <ArrowRight className="h-4 w-4 text-white" />
                                    </div>
                                </span>
                            )}
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
}
