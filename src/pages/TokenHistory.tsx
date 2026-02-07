import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServices } from "@/hooks/useQueue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Calendar, CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { format } from "date-fns";
import { useMemo } from "react";
import MobileNav from "@/components/MobileNav";

interface HistoryToken {
  id: string;
  token_number: number;
  service_id: string;
  status: string;
  estimated_wait: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  services?: { name: string };
}

export default function TokenHistory() {
  const { user, loading: authLoading } = useAuth();
  const { data: services } = useServices();

  const { data: tokens, isLoading } = useQuery({
    queryKey: ["my-token-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select(`
          *,
          services (
            name
          )
        `)
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      // Force cast to break deep inference recursion
      return data as unknown as HistoryToken[];
    },
  });

  // Simplified service map since we can now fetch service name directly if we wanted, 
  // but keeping it for existing logic if services hook is cached.
  const serviceMap = useMemo(() => {
    const map: Record<string, string> = {};
    services?.forEach((s) => (map[s.id] = s.name));
    return map;
  }, [services]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" />;

  return (
    <div className="min-h-screen bg-neutral-50 font-sans pb-24 md:pb-0">
      <nav className="px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-neutral-100">
        <h1 className="font-bold text-lg leading-tight text-neutral-900">Your History</h1>
        <Link to="/profile" className="h-8 w-8 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-600">
          <span className="text-xs font-bold">{user.email?.slice(0, 2).toUpperCase()}</span>
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-neutral-400" />
          </div>
        ) : !tokens?.length ? (
          <div className="text-center py-16">
            <div className="h-16 w-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 mb-2">No History Yet</h2>
            <p className="text-neutral-500 mb-8 max-w-xs mx-auto">It looks like you haven't joined any queues yet.</p>
            <Link to="/">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8">
                Get Your First Ticket
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-1 mb-2">Recent Tickets</h2>
            {tokens.map((token) => (
              <Link key={token.id} to={`/queue/${token.id}`}>
                <Card className="p-4 bg-white border-none shadow-sm hover:shadow-md transition-all mb-4 group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`h-14 w-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border ${token.status === 'serving' ? 'bg-green-50 border-green-100 text-green-700' :
                      token.status === 'completed' ? 'bg-neutral-50 border-neutral-100 text-neutral-400' :
                        token.status === 'cancelled' ? 'bg-red-50 border-red-100 text-red-500' :
                          'bg-blue-50 border-blue-100 text-blue-600'
                      }`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                        {token.status === 'serving' ? 'NOW' :
                          token.status === 'completed' ? 'DONE' :
                            token.status === 'cancelled' ? 'CANC' : '#'}
                      </span>
                      <span className="font-display font-bold text-xl leading-none">
                        {String(token.token_number).padStart(3, "0")}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-neutral-900 truncate">
                        {serviceMap[token.service_id] || "Unknown Service"}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(token.created_at), "MMM d, h:mm a")}
                        </span>
                        {token.status === 'waiting' && (
                          <span className="text-blue-600 font-medium px-1.5 py-0.5 bg-blue-50 rounded-md">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-neutral-300 group-hover:text-blue-500 transition-colors">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
