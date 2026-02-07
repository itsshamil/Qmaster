# 🧠 Queue Buddy AI Prediction Engine

The Smart Wait Time Prediction is the core innovation of Queue Buddy. Unlike traditional "fixed-time" counters, our engine uses a dynamic, historical-performance-based algorithm.

---

## ⚙️ The Algorithm

Our prediction model follows a **rolling-average concurrency formula**:

### 1. Variables
- **WT** (Waiting Tokens): Number of customers currently in the queue (Waiting + Serving).
- **AST** (Average Service Time): The calculated speed of the staff.
- **AS** (Active Staff): Number of staff members currently online and available for that service.

### 2. The Logic Flow
1. **Historical Sampling**: The engine retrieves the **last 20 completed tokens** for the specific service.
2. **Speed Calculation**: It extracts the epoch time between `started_at` and `ended_at` for these 20 samples to find the current "Staff Velocity".
3. **Fallback Protection**:
   - If history < 20: Use the `avg_service_time` parameter defined in the Service settings.
   - If Service settings are missing: Use a global default of **5 minutes** per person.
4. **Concurrency Adjustment**: The formula assumes parallel processing. If you have 2 staff members, the queue speed doubles.

### 3. The Formula
$$\text{Prediction (mins)} = \lceil \frac{\text{WT} \times \text{AST}}{\text{MAX(1, AS)}} \rceil$$

---

## 🛠 Technical Implementation

### Backend: Postgres RPC (`get_service_metrics`)
To ensure high performance and consistent logic across all platforms, the math is executed in the database:

```sql
SELECT AVG(duration) INTO v_avg_service_time
FROM (
  SELECT EXTRACT(EPOCH FROM (ended_at - started_at))/60 as duration
  FROM public.tokens
  WHERE service_id = p_service_id AND status = 'completed'
  ORDER BY ended_at DESC LIMIT 20
) recent_history;
```

### Frontend: React Integration
- **Hook**: `useServiceMetrics` in `src/hooks/useQueue.ts` fetches this data using TanStack Query.
- **Real-time Sync**: When any token status changes (e.g., staff calls someone), the database triggers a recalculation, and the UI updates instantly via Supabase Realtime.

---

## 🎯 Key Benefits for Hackathons
- **Zero-Latency**: Math stays close to the data (SQL).
- **Self-Learning**: The system automatically adjusts if a staff member is having a slow day or if a service suddenly gets easier.
- **Scalable**: Handles 1 counter or 100 counters using the same logic.
