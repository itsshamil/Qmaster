-- Update AI prediction default to 5 minutes per person
-- This ensures consistent wait time calculations across the application

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
  SELECT AVG(duration)
  INTO v_avg_service_time
  FROM (
    SELECT EXTRACT(EPOCH FROM (ended_at - started_at))/60 as duration
    FROM public.tokens
    WHERE service_id = p_service_id
      AND status = 'completed'
      AND started_at IS NOT NULL
      AND ended_at IS NOT NULL
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
  
  -- If still null, default to 5 mins per person (updated from 10)
  IF v_avg_service_time IS NULL THEN
    v_avg_service_time := 5;
  END IF;

  -- 5. Calculate Prediction
  IF v_active_staff_count < 1 THEN
    v_active_staff_count := 1;
  END IF;

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
