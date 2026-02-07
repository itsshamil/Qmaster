
import { Token } from "@/hooks/useQueue";

interface TicketDisplayProps {
    token: Token;
    initialServiceName?: string;
    position?: number;
}

export function TicketDisplay({ token, initialServiceName, position }: TicketDisplayProps) {
    const isWaiting = token.status === "waiting";
    const isServing = token.status === "serving";
    const isCompleted = token.status === "completed";
    const isCancelled = token.status === "cancelled";

    return (
        <div className="p-8 text-center">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6">
                {token.services?.name || initialServiceName || "SERVICE"}
            </h3>

            <div className="relative inline-block mb-6">
                <h1 className={`text-7xl font-bold font-display tracking-tighter ${isCancelled ? "text-neutral-300 line-through" : "text-neutral-900"
                    }`}>
                    {String(token.token_number || "000").padStart(3, "0")}
                </h1>
                {/* Floating Badge */}
                {isWaiting && position && (
                    <div className="absolute -top-4 -right-8 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md transform rotate-12 shadow-md border-2 border-white">
                        #{position} in line
                    </div>
                )}
            </div>

            <div className="mb-10">
                {isWaiting && <span className="bg-yellow-100 text-yellow-800 text-sm font-bold px-4 py-2 rounded-full uppercase tracking-wide">You are Waiting</span>}
                {isServing && <span className="bg-green-100 text-green-800 text-sm font-bold px-4 py-2 rounded-full uppercase tracking-wide animate-pulse">Now Serving</span>}
                {isCompleted && <span className="bg-neutral-100 text-neutral-800 text-sm font-bold px-4 py-2 rounded-full uppercase tracking-wide">Completed</span>}
                {isCancelled && <span className="bg-red-100 text-red-800 text-sm font-bold px-4 py-2 rounded-full uppercase tracking-wide">Cancelled</span>}
            </div>
        </div>
    );
}
