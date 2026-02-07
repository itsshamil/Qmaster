import { useTokens, useServiceMetrics, Token } from "@/hooks/useQueue";
import { Users, Clock, Brain } from "lucide-react";

interface QueueLineupProps {
    currentToken: Token;
}

// Format masked name as SXXXXL (first letter, X's, last letter)
function formatMaskedName(maskedName: string | null | undefined): string {
    if (!maskedName) return "Visitor";
    const name = maskedName.trim();
    if (name.length <= 1) return name;
    if (name.length === 2) return name[0] + 'X' + name[1];
    const firstChar = name[0];
    const lastChar = name[name.length - 1];
    const xCount = Math.max(2, name.length - 2);
    return firstChar + 'X'.repeat(xCount) + lastChar;
}

export function QueueLineup({ currentToken }: QueueLineupProps) {
    const { data: allTokens } = useTokens(currentToken.service_id);
    const { data: metrics } = useServiceMetrics(currentToken.service_id);

    if (!allTokens) return null;

    // Filter tokens for the same service and waiting/serving status
    const queueTokens = allTokens
        .filter(t => t.status === "waiting" || t.status === "serving")
        .sort((a, b) => a.token_number - b.token_number);

    const currentIndex = queueTokens.findIndex(t => t.id === currentToken.id);
    const tokensAhead = currentIndex >= 0 ? queueTokens.slice(0, currentIndex) : [];
    const tokensBehind = currentIndex >= 0 ? queueTokens.slice(currentIndex + 1) : [];

    if (tokensAhead.length === 0 && tokensBehind.length === 0) {
        return null;
    }

    // Calculate wait time per person based on AI prediction
    const avgTimePerPerson = metrics && metrics.waiting_count > 0
        ? Math.ceil(metrics.predicted_wait_mins / metrics.waiting_count)
        : metrics?.avg_service_time_recent || 5; // Default to 5 minutes per person

    // Calculate wait time for each token based on their position
    const calculateWaitTime = (position: number) => {
        return Math.ceil(position * avgTimePerPerson);
    };

    return (
        <div className="px-8 pb-8">
            <div className="border-t border-neutral-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" />
                        Queue Lineup
                    </h3>
                    {metrics && (
                        <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg px-3 py-1.5">
                            <Brain className="h-3.5 w-3.5 text-purple-600" />
                            <div className="text-xs">
                                <span className="font-bold text-purple-900">AI Prediction: </span>
                                <span className="font-bold text-purple-600">{metrics.predicted_wait_mins}m</span>
                                <span className="text-neutral-500 ml-1">total wait</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    {/* People Ahead */}
                    {tokensAhead.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wide">
                                {tokensAhead.length} {tokensAhead.length === 1 ? 'Person' : 'People'} Ahead
                            </p>
                            <div className="space-y-1.5">
                                {tokensAhead.map((token, index) => (
                                    <div
                                        key={token.id}
                                        className="flex items-center justify-between bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold text-blue-600 text-xs bg-blue-100 px-2 py-0.5 rounded">
                                                #{token.token_number}
                                            </span>
                                            <span className="text-neutral-600 font-medium">
                                                {formatMaskedName(token.profiles?.masked_name)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-neutral-500">
                                            <Clock className="h-3 w-3" />
                                            <span>~{calculateWaitTime(index + 1)}m</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Current Position */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg px-3 py-3 text-sm shadow-lg">
                        <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-xs bg-white/20 px-2 py-0.5 rounded">
                                #{currentToken.token_number}
                            </span>
                            <span className="font-bold">You (Current Position)</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            <span>~{calculateWaitTime(currentIndex + 1)}m</span>
                        </div>
                    </div>

                    {/* People Behind */}
                    {tokensBehind.length > 0 && (
                        <div className="mt-4">
                            <p className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wide">
                                {tokensBehind.length} {tokensBehind.length === 1 ? 'Person' : 'People'} Behind
                            </p>
                            <div className="space-y-1.5">
                                {tokensBehind.slice(0, 5).map((token, index) => (
                                    <div
                                        key={token.id}
                                        className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold text-neutral-500 text-xs bg-neutral-200 px-2 py-0.5 rounded">
                                                #{token.token_number}
                                            </span>
                                            <span className="text-neutral-600 font-medium">
                                                {formatMaskedName(token.profiles?.masked_name)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-neutral-500">
                                            <Clock className="h-3 w-3" />
                                            <span>~{calculateWaitTime(currentIndex + index + 2)}m</span>
                                        </div>
                                    </div>
                                ))}
                                {tokensBehind.length > 5 && (
                                    <p className="text-xs text-neutral-400 text-center py-2">
                                        +{tokensBehind.length - 5} more behind you
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
