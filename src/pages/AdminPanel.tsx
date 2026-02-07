import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, XCircle, Clock, Users, Shield } from "lucide-react";

interface PendingStaff {
    id: string;
    name: string;
    email: string;
    created_at: string;
    approved: boolean;
}

export default function AdminPanel() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [pendingStaff, setPendingStaff] = useState<PendingStaff[]>([]);
    const [allStaff, setAllStaff] = useState<PendingStaff[]>([]);

    useEffect(() => {
        const checkAdminAndLoadData = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                navigate("/staff/login");
                return;
            }

            // Check if user is admin
            const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                .select("is_admin")
                .eq("id", session.user.id)
                .single();

            if (profileError || !profileData?.is_admin) {
                toast.error("Access denied. Admin privileges required.");
                navigate("/staff");
                return;
            }

            setIsAdmin(true);
            await loadStaffData();
            setLoading(false);
        };

        checkAdminAndLoadData();
    }, [navigate]);

    const loadStaffData = async () => {
        // Load pending staff
        const { data: pending, error: pendingError } = await supabase
            .from("staff")
            .select(`
        id,
        name,
        approved,
        created_at,
        profiles:id (email)
      `)
            .eq("approved", false)
            .order("created_at", { ascending: false });

        if (!pendingError && pending) {
            setPendingStaff(pending.map((s: any) => ({
                id: s.id,
                name: s.name,
                email: s.profiles?.email || "N/A",
                created_at: s.created_at,
                approved: s.approved
            })));
        }

        // Load all staff
        const { data: all, error: allError } = await supabase
            .from("staff")
            .select(`
        id,
        name,
        approved,
        created_at,
        profiles:id (email)
      `)
            .order("created_at", { ascending: false });

        if (!allError && all) {
            setAllStaff(all.map((s: any) => ({
                id: s.id,
                name: s.name,
                email: s.profiles?.email || "N/A",
                created_at: s.created_at,
                approved: s.approved
            })));
        }
    };

    const handleApprove = async (staffId: string) => {
        const { error } = await supabase
            .from("staff")
            .update({
                approved: true,
                approved_at: new Date().toISOString(),
                approved_by: (await supabase.auth.getUser()).data.user?.id
            })
            .eq("id", staffId);

        if (error) {
            toast.error("Failed to approve staff member");
            return;
        }

        toast.success("Staff member approved!");
        await loadStaffData();
    };

    const handleReject = async (staffId: string) => {
        if (!confirm("Are you sure you want to reject this staff member? This will delete their staff record.")) {
            return;
        }

        const { error } = await supabase
            .from("staff")
            .delete()
            .eq("id", staffId);

        if (error) {
            toast.error("Failed to reject staff member");
            return;
        }

        toast.success("Staff member rejected");
        await loadStaffData();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-50">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50 font-sans pb-24">
            <nav className="px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-neutral-100">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-purple-600 rounded-lg flex items-center justify-center">
                        <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight text-neutral-900">Admin Panel</h1>
                        <p className="text-xs text-neutral-500">Staff Management</p>
                    </div>
                </div>
                <Link to="/staff" className="text-sm font-medium text-neutral-600 hover:text-blue-600 transition-colors">
                    <ArrowLeft className="h-4 w-4 inline mr-1" /> Back to Dashboard
                </Link>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Pending Approvals */}
                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-6">
                        <Clock className="h-5 w-5 text-orange-600" />
                        <h2 className="text-2xl font-bold text-neutral-900">Pending Approvals</h2>
                        <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">
                            {pendingStaff.length}
                        </span>
                    </div>

                    {pendingStaff.length === 0 ? (
                        <Card className="p-8 text-center bg-white">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <p className="text-neutral-500">No pending approvals</p>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {pendingStaff.map((staff) => (
                                <Card key={staff.id} className="p-6 bg-white border-l-4 border-orange-500">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-neutral-900">{staff.name}</h3>
                                            <p className="text-sm text-neutral-500">{staff.email}</p>
                                            <p className="text-xs text-neutral-400 mt-1">
                                                Applied: {new Date(staff.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            <Button
                                                onClick={() => handleApprove(staff.id)}
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                            >
                                                <CheckCircle className="h-4 w-4 mr-2" /> Approve
                                            </Button>
                                            <Button
                                                onClick={() => handleReject(staff.id)}
                                                variant="outline"
                                                className="border-red-200 text-red-600 hover:bg-red-50"
                                            >
                                                <XCircle className="h-4 w-4 mr-2" /> Reject
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* All Staff */}
                <div>
                    <div className="flex items-center gap-2 mb-6">
                        <Users className="h-5 w-5 text-blue-600" />
                        <h2 className="text-2xl font-bold text-neutral-900">All Staff Members</h2>
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                            {allStaff.length}
                        </span>
                    </div>

                    <div className="grid gap-4">
                        {allStaff.map((staff) => (
                            <Card key={staff.id} className={`p-6 bg-white ${staff.approved ? 'border-l-4 border-green-500' : 'border-l-4 border-orange-500'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-bold text-lg text-neutral-900">{staff.name}</h3>
                                            {staff.approved ? (
                                                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                                                    Approved
                                                </span>
                                            ) : (
                                                <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">
                                                    Pending
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-neutral-500">{staff.email}</p>
                                        <p className="text-xs text-neutral-400 mt-1">
                                            Joined: {new Date(staff.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
