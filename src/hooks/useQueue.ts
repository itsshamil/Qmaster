import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export interface Service {
  id: string;
  name: string;
  avg_service_time: number;
  priority_level: number;
  icon: string;
  location_lat?: number;
  location_long?: number;
  radius_meters?: number;
}

export interface Token {
  id: string;
  token_number: number;
  service_id: string;
  status: "waiting" | "serving" | "completed" | "cancelled";
  estimated_wait: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  staff_id: string | null;
  customer_id: string | null;
  profiles?: { masked_name: string | null } | null;
  services?: { name: string };
  queue_position?: number;
}

export interface Staff {
  id: string;
  name: string;
  service_id: string | null;
  is_available: boolean;
}

export interface Session {
  id?: number;
  session_id: string;
  service_id: string;
  staff_id: string;
  marked: boolean;
  marked_at: string | null;
  created_at: string;
  ended_at: string | null;
}

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("priority_level", { ascending: false });
      if (error) throw error;
      return data as Service[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10,
  });
}

export function useTokens(serviceId?: string) {
  const queryClient = useQueryClient();

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`tokens-${serviceId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'tokens',
          filter: serviceId ? `service_id=eq.${serviceId}` : undefined,
        },
        (payload) => {
          console.log('Realtime token update:', payload);
          // Invalidate and refetch tokens query
          queryClient.invalidateQueries({ queryKey: ['tokens', serviceId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serviceId, queryClient]);

  return useQuery({
    queryKey: ["tokens", serviceId],
    queryFn: async () => {
      let q = supabase
        .from("tokens")
        .select("*, profiles:customer_id(masked_name)")
        .gte("created_at", new Date().toISOString().split("T")[0])
        .neq("status", "cancelled")
        .order("token_number", { ascending: true });

      if (serviceId) q = q.eq("service_id", serviceId);

      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Token[];
    },
    staleTime: 1000 * 60, // rely on realtime updates; keep cache for 60s
    refetchOnWindowFocus: false,
  });
}

export function useToken(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["token", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("*, services:service_id(name), profiles:customer_id(masked_name)")
        .eq("id", id)
        .single();

      if (error) throw error;
      // Calculate queue position if waiting: prefer cached tokens to avoid extra request
      let position = 0;
      if (data.status === 'waiting') {
        const cached = queryClient.getQueryData<Token[]>(["tokens", data.service_id]);
        if (cached) {
          const ahead = (cached || []).filter(t => t.status === 'waiting' && t.token_number < data.token_number).length;
          position = ahead + 1;
        } else {
          const { count } = await supabase
            .from("tokens")
            .select("*", { count: 'exact', head: true })
            .eq("service_id", data.service_id)
            .eq("status", "waiting")
            .lt("token_number", data.token_number)
            .gte("created_at", new Date().toISOString().split("T")[0]);
          position = (count || 0) + 1;
        }
      }

      return { ...data, queue_position: position } as unknown as Token;
    },
    enabled: !!id,
    // rely on realtime invalidation instead of polling
  });
}

export function useActiveToken() {
  const queryClient = useQueryClient();
  const { user } = useAuth(); // Depend on the auth context user

  return useQuery({
    queryKey: ["active-token", user?.id], // Include user ID in query key
    queryFn: async () => {
      // If no user in context, try fetching just in case, or return null
      const userId = user?.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from("tokens")
        .select("*, services:service_id(name), profiles:customer_id(masked_name)")
        .eq("customer_id", userId)
        .in("status", ["waiting", "serving"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      // Calculate queue position if waiting: prefer cached tokens
      let position = 0;
      if (data.status === 'waiting') {
        const cached = queryClient.getQueryData<Token[]>(["tokens", data.service_id]);
        if (cached) {
          const ahead = (cached || []).filter(t => t.status === 'waiting' && t.token_number < data.token_number).length;
          position = ahead + 1;
        } else {
          const { count } = await supabase
            .from("tokens")
            .select("*", { count: 'exact', head: true })
            .eq("service_id", data.service_id)
            .eq("status", "waiting")
            .lt("token_number", data.token_number)
            .gte("created_at", new Date().toISOString().split("T")[0]);
          position = (count || 0) + 1;
        }
      }

      return { ...data, queue_position: position } as unknown as Token;
    },
    enabled: !!user, // Only run if user is available
    // Rely on realtime subscriptions to invalidate this query; avoid continuous polling
  });
}

export const useQueueRealtime = useRealtimeSync;

export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*");
      if (error) throw error;
      return data as Staff[];
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

export function useCreateToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceId, userId }: { serviceId: string; userId?: string }) => {
      // Get next token number
      const { data: nextNum, error: numError } = await supabase.rpc("next_token_number", { p_service_id: serviceId });
      if (numError) throw numError;

      // Fetch service metrics and service info in parallel
      const todayIso = new Date().toISOString().split("T")[0];
      const [metricsRes, serviceRes] = await Promise.all([
        supabase.rpc("get_service_metrics", { p_service_id: serviceId }),
        supabase.from("services").select("is_paused,daily_limit").eq("id", serviceId).single(),
      ]);

      // Check for errors in parallel responses
      if (metricsRes.error) throw metricsRes.error;
      if (serviceRes.error) throw serviceRes.error;

      const metrics = metricsRes.data as { predicted_wait_mins: number; waiting_count: number };
      const service = serviceRes.data;

      if (!service) throw new Error('Service not found');
      if ((service as any).is_paused) throw new Error('Service is paused');

      // enforce daily limit if set (count only waiting/serving)
      const dailyLimit = (service as any).daily_limit as number | undefined;
      if (typeof dailyLimit === 'number' && dailyLimit > 0) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from('tokens')
          .select('*', { count: 'exact', head: true })
          .eq('service_id', serviceId)
          .gte('created_at', todayStart.toISOString())
          .in('status', ['waiting', 'serving']);
        const todayCount = (count || 0);
        if (todayCount >= dailyLimit) throw new Error('Daily limit reached');
      }

      // Use AI prediction for estimated wait time
      // New person will be at position (waiting_count + 1)
      const avgTimePerPerson = metrics.waiting_count > 0
        ? Math.ceil(metrics.predicted_wait_mins / metrics.waiting_count)
        : metrics.predicted_wait_mins || 5; // Default to 5 minutes per person
      const estimatedWait = Math.ceil((metrics.waiting_count + 1) * avgTimePerPerson);

      const { data, error } = await supabase
        .from("tokens")
        .insert({
          token_number: nextNum as number,
          service_id: serviceId,
          estimated_wait: estimatedWait,
          customer_id: userId || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tokens"] });
      queryClient.invalidateQueries({ queryKey: ["active-token"] });
    },
  });
}

export function useUpdateToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Token> & { id: string }) => {
      const { data, error } = await supabase.from("tokens").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as unknown as Token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tokens"] });
      queryClient.invalidateQueries({ queryKey: ["active-token"] });
    },
  });
}

export function useToggleStaffAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_available }: { id: string; is_available: boolean }) => {
      const { error } = await supabase.from("staff").update({ is_available }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

export function useCancelToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("tokens")
        .update({ status: "cancelled", ended_at: new Date().toISOString() })
        .eq("id", tokenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tokens"] });
    },
  });
}

export function useRealtimeSync(tokenId?: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("queue-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tokens" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tokens"] });
        if (tokenId) {
          queryClient.invalidateQueries({ queryKey: ["token", tokenId] });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "staff" }, () => {
        queryClient.invalidateQueries({ queryKey: ["staff"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => {
        queryClient.invalidateQueries({ queryKey: ["services"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tokenId]);
}

export function useSessions(serviceId?: string) {
  return useQuery({
    queryKey: ["sessions", serviceId],
    queryFn: async () => {
      let q = supabase.from("sessions").select("*").order("created_at", { ascending: false });
      if (serviceId) q = q.eq("service_id", serviceId);
      const { data, error } = await q;
      if (error && error.code !== "PGRST116") throw error;
      return (data || []) as Session[];
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceId, staffId }: { serviceId: string; staffId: string }) => {
      const sessionId = `SES-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          session_id: sessionId,
          service_id: serviceId,
          staff_id: staffId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useMarkSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, marked }: { sessionId: string; marked: boolean }) => {
      const { error } = await supabase
        .from("sessions")
        .update({
          marked,
          marked_at: marked ? new Date().toISOString() : null,
        })
        .eq("session_id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}


export function calcEstimatedWait(tokensAhead: number, avgServiceTime: number, availableStaff: number) {
  const staff = Math.max(availableStaff, 1);
  return Math.ceil((tokensAhead * avgServiceTime) / staff);
}

export function useServiceMetrics(serviceId: string | null) {
  return useQuery({
    queryKey: ["service-metrics", serviceId],
    queryFn: async () => {
      if (!serviceId) return null;
      const { data, error } = await supabase.rpc("get_service_metrics", { p_service_id: serviceId });
      if (error) throw error;
      return data as {
        service_id: string;
        waiting_count: number;
        active_staff: number;
        avg_service_time_recent: number;
        predicted_wait_mins: number;
      };
    },
    enabled: !!serviceId,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refresh every minute
  });
}
