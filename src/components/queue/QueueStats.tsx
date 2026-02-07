
import { MapPin, Clock } from "lucide-react";

interface QueueStatsProps {
    status: "waiting" | "serving" | "completed" | "cancelled";
    position?: number;
    estimatedWait?: number;
}

export function QueueStats({ status, position, estimatedWait }: QueueStatsProps) {
    const isWaiting = status === "waiting";
    const isServing = status === "serving";

    if (!isWaiting && !isServing) return null;

    return (
        <div className="grid grid-cols-1 gap-4 mb-10 px-8">
            <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 text-center">
                <div className="flex justify-center text-blue-600 mb-2">
                    <MapPin className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-neutral-900 leading-none mb-1">
                    {position !== undefined && position > 0 ? position - 1 : 0}
                </p>
                <p className="text-[10px] text-neutral-500 font-medium uppercase">
                    People Ahead
                </p>
            </div>
        </div>
    );
}
