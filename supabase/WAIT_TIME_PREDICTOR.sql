-- ALGORITHM FOR WAIT TIME PREDICTOR
-- 1. Calculate Average Service Time (AST) from the last 20 completed tokens for the service.
-- 2. If no history, use the static avg_service_time from the services table.
-- 3. Count Waiting Tokens (WT).
-- 4. Count Active Staff (AS).
-- 5. Estimated Duration = (WT * AST) / MAX(1, AS)

CREATE OR REPLACE FUNCTION public.get_service_metrics(p_service_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_waiting_count INT;
  v_active_staff_count INT;
  v_avg_service_time NUMERIC;
  v_default_avg_time NUMERIC;
  v_predicted_wait_mins INT;
BEGIN
  -- 1. Get Waiting Count (waiting + serving)
  SELECT COUNT(*)
  INTO v_waiting_count
  FROM public.tokens
  WHERE service_id = p_service_id
    AND status IN ('waiting', 'serving')
    AND created_at >= CURRENT_DATE;

  -- 2. Get Active Staff Count
  SELECT COUNT(*)
  INTO v_active_staff_count
  FROM public.staff
  WHERE service_id = p_service_id
    AND is_available = true;

  -- 3. Get Recent Average Service Time (last 20 completed tokens)
  -- We use a subquery to limit to 20, then average those.
  SELECT AVG(duration)
  INTO v_avg_service_time
  FROM (
    SELECT EXTRACT(EPOCH FROM (ended_at - started_at))/60 as duration
    FROM public.tokens
    WHERE service_id = p_service_id
      AND status = 'completed'
      AND started_at IS NOT NULL
      AND ended_at IS NOT NULL
      -- Optional: Ensure we don't use super old data if the service changed drastically? 
      -- For now, just last 20 records is good.
    ORDER BY ended_at DESC
    LIMIT 20
  ) recent_history;

  -- 4. Get Default Service Time if history is insufficient
  SELECT avg_service_time
  INTO v_default_avg_time
  FROM public.services
  WHERE id = p_service_id;

  -- Fallback logic
  IF v_avg_service_time IS NULL THEN
    v_avg_service_time := v_default_avg_time;
  END IF;
  
  -- If still null (e.g. service has no default?), default to 5 mins per person
  IF v_avg_service_time IS NULL THEN
    v_avg_service_time := 5;
  END IF;

  -- 5. Calculate Prediction
  -- Standard queue formula: (Customers in Queue * Avg Service Time) / Number of Servers
  -- Ensure active staff is at least 1 for division
  IF v_active_staff_count < 1 THEN
    v_active_staff_count := 1;
  END IF;

  -- Calculation
  v_predicted_wait_mins := CEIL((v_waiting_count * v_avg_service_time) / v_active_staff_count);
  
  RETURN jsonb_build_object(
    'service_id', p_service_id,
    'waiting_count', v_waiting_count,
    'active_staff', v_active_staff_count,
    'avg_service_time_recent', ROUND(v_avg_service_time, 1),
    'predicted_wait_mins', v_predicted_wait_mins
  );
END;
$$ LANGUAGE plpgsql;
