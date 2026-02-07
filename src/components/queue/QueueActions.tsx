
import { Button } from "@/components/ui/button";
import { Share2, XCircle, Home, History } from "lucide-react";
import { Link } from "react-router-dom";

interface QueueActionsProps {
    status: "waiting" | "serving" | "completed" | "cancelled";
    cancelling: boolean;
    onShare: () => void;
    onCancel: () => void;
}

export function QueueActions({ status, cancelling, onShare, onCancel }: QueueActionsProps) {
    const isWaiting = status === "waiting";
    const isCompleted = status === "completed";
    const isCancelled = status === "cancelled";

    return (
        <div className="space-y-3 px-8 pb-8">
            <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="border-neutral-200 text-neutral-700 hover:bg-neutral-50 h-11" onClick={onShare}>
                    <Share2 className="h-4 w-4 mr-2" /> Share
                </Button>

                <Link to="/history" className="block">
                    <Button variant="outline" className="w-full border-neutral-200 text-neutral-700 hover:bg-neutral-50 h-11">
                        <History className="h-4 w-4 mr-2" /> History
                    </Button>
                </Link>
            </div>

            {isWaiting && (
                <Button
                    variant="ghost"
                    className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 h-11"
                    onClick={onCancel}
                    disabled={cancelling}
                >
                    <XCircle className="h-4 w-4 mr-2" /> {cancelling ? "Cancelling..." : "Leave Queue"}
                </Button>
            )}

            {(isCompleted || isCancelled) && (
                <Link to="/" className="block w-full">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 h-11">
                        <Home className="h-4 w-4 mr-2" /> Back to Home
                    </Button>
                </Link>
            )}
        </div>
    );
}
