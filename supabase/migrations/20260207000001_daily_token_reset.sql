-- FUNCTION: Reset token numbers daily
-- Updates the token generation logic to only consider tokens created today
-- This ensures that the first token of the day is always #1

CREATE OR REPLACE FUNCTION public.next_token_number(p_service_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  v_next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(token_number), 0) + 1
  INTO v_next_num
  FROM tokens
  WHERE service_id = p_service_id
    AND created_at >= CURRENT_DATE; -- Limit scope to today
  
  RETURN v_next_num;
END;
$function$;
