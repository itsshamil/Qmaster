import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Loader2, Save, LogOut } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";

export default function Profile() {
    const { user, signOut, loading: authLoading } = useAuth();
    const [fullName, setFullName] = useState("");
    const [saving, setSaving] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(true);

    useEffect(() => {
        if (user) {
            const fetchProfile = async () => {
                const { data } = await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", user.id)
                    .single();

                if (data) {
                    setFullName(data.full_name || "");
                }
                setLoadingConfig(false);
            };
            fetchProfile();
        } else if (!authLoading) {
            setLoadingConfig(false);
        }
    }, [user, authLoading]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);

        // Don't manually set masked_name - let the database trigger handle it
        const { error, data } = await supabase
            .from("profiles")
            .update({
                full_name: fullName,
            })
            .eq("id", user.id)
            .select("full_name, masked_name")
            .maybeSingle(); // Use maybeSingle instead of single to handle 0 rows

        if (error) {
            console.error("Profile update error:", error);
            toast.error(`Failed to update profile: ${error.message}`);
        } else if (!data) {
            console.error("Profile update returned no data - possible RLS issue");
            toast.error("Failed to update profile. Please check permissions.");
        } else {
            toast.success("Profile updated successfully");
            // Refresh the displayed name immediately
            setFullName(data.full_name || "");
        }
        setSaving(false);
    };

    const handleSignOut = async () => {
        await signOut();
    }

    if (authLoading || loadingConfig) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!user) return <Navigate to="/auth" />;

    return (
        <div className="min-h-screen bg-neutral-50 pb-24 md:pb-0 font-sans">
            <nav className="px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                    <Link to="/" className="h-8 w-8 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-600 hover:bg-neutral-200 transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <h1 className="font-bold text-lg text-neutral-900">My Profile</h1>
                </div>
            </nav>

            <main className="max-w-md mx-auto px-6 py-8">
                {/* Profile Header */}
                <div className="text-center mb-8">
                    <div className="h-24 w-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto flex items-center justify-center shadow-lg mb-4 text-white text-3xl font-display font-bold">
                        {user.email?.charAt(0).toUpperCase()}
                    </div>
                    <h2 className="text-xl font-bold text-neutral-900">{fullName || "User"}</h2>
                    <p className="text-neutral-500 text-sm">{user.email}</p>
                </div>

                <Card className="p-6 bg-white border-none shadow-sm rounded-2xl mb-6">
                    <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide mb-4">Account Details</h3>
                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="text-xs font-medium text-neutral-500 uppercase">Full Name</Label>
                            <Input
                                id="fullName"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Your Name"
                                className="h-11 bg-neutral-50 border-neutral-200 focus:border-blue-500 focus:ring-blue-500/20"
                            />
                            <p className="text-[10px] text-neutral-400">
                                Visible as <span className="font-mono text-neutral-600 bg-neutral-100 px-1 rounded">{fullName.length > 2 ? `${fullName[0]}. ${fullName.split(" ").pop() || ""}` : "..."}</span> on public screens
                            </p>
                        </div>

                        <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-medium" disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </form>
                </Card>

                {/* Ticket History Section */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <span className="h-1 w-4 bg-purple-500 rounded-full" />
                        Recent History
                    </h3>
                    <ProfileHistoryList userId={user.id} />
                </div>

                <Button variant="outline" className="w-full h-11 border-neutral-200 text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-100" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </Button>

                <p className="text-center text-xs text-neutral-300 mt-8">
                    Version 1.0.0 • Transparent Queue
                </p>
            </main>
            <MobileNav />
        </div>
    );
}

// Inline component for history list to keep file self-contained as requested
function ProfileHistoryList({ userId }: { userId: string }) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchHistory() {
            const { data } = await supabase
                .from("tokens")
                .select(`
            *,
            services (name)
        `)
                .eq("customer_id", userId)
                .order("created_at", { ascending: false })
                .limit(5); // Last 5 tickets only

            setHistory(data || []);
            setLoading(false);
        }
        fetchHistory();
    }, [userId]);

    if (loading) return <div className="text-center py-4 text-xs text-neutral-400">Loading history...</div>;

    if (history.length === 0) return (
        <Card className="p-6 border-dashed border-2 border-neutral-100 rounded-2xl bg-transparent text-center">
            <p className="text-neutral-400 text-sm">No ticket history found.</p>
        </Card>
    );

    return (
        <div className="space-y-3">
            {history.map((token) => (
                <Card key={token.id} className="p-4 bg-white border-none shadow-sm rounded-xl flex justify-between items-center group hover:shadow-md transition-all">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-neutral-900 font-display text-lg tracking-tight">#{token.token_number}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide ${token.status === 'completed' ? 'bg-green-100 text-green-700' :
                                token.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                {token.status}
                            </span>
                        </div>
                        <p className="text-xs text-neutral-500 font-medium">{token.services?.name}</p>
                        <p className="text-[10px] text-neutral-400 mt-1">
                            {new Date(token.created_at).toLocaleDateString("en-IN", { weekday: 'short', day: 'numeric', month: 'short' })} •
                            {new Date(token.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    {token.estimated_wait && (
                        <div className="text-right">
                            <p className="text-[10px] text-neutral-400 uppercase font-bold">Wait</p>
                            <p className="text-sm font-bold text-neutral-900">{token.estimated_wait}m</p>
                        </div>
                    )}
                </Card>
            ))}
            <div className="text-center">
                <Link to="/history" className="text-xs text-blue-600 font-medium hover:underline">View All History</Link>
            </div>
        </div>
    );
}
