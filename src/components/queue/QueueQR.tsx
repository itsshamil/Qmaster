import { QRCodeSVG } from "qrcode.react";
import { Maximize2, X } from "lucide-react";
import { useState } from "react";

interface QueueQRProps {
    url: string;
}

export function QueueQR({ url }: QueueQRProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            {/* Regular QR View */}
            <div className="mb-8 flex flex-col items-center px-8">
                <p className="text-xs text-neutral-400 mb-4 uppercase tracking-wide font-medium">Scan to track</p>
                <div className="relative group">
                    <div className="p-3 bg-white border border-neutral-100 rounded-xl shadow-sm">
                        <QRCodeSVG value={url} size={120} />
                    </div>
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="absolute top-2 right-2 bg-blue-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-blue-700"
                        aria-label="Expand QR Code"
                    >
                        <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Expanded QR Modal */}
            {isExpanded && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsExpanded(false)}
                >
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors backdrop-blur-sm"
                            aria-label="Close"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <div className="bg-white p-8 rounded-3xl shadow-2xl">
                            <QRCodeSVG value={url} size={300} />
                        </div>
                        <p className="text-white text-center mt-4 text-sm font-medium">
                            Scan to track your queue status
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
