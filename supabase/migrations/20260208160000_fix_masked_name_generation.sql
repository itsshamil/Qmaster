-- Fix the generate_masked_name function to use a user-friendly format
-- Changes "John Doe" from "J((XXXX))e" to "J. Doe"

CREATE OR REPLACE FUNCTION public.generate_masked_name()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.full_name IS NOT NULL AND TRIM(NEW.full_name) != '' THEN
        -- Extract first initial and last name
        -- "John Doe" -> "J. Doe"
        -- "Alice" -> "A***e"
        DECLARE
            words TEXT[];
            first_initial TEXT;
            last_part TEXT;
        BEGIN
            -- Split name by spaces
            words := string_to_array(TRIM(NEW.full_name), ' ');
            
            IF array_length(words, 1) >= 2 THEN
                -- Multi-word name: use first initial + last word
                first_initial := UPPER(LEFT(words[1], 1));
                last_part := words[array_length(words, 1)];
                NEW.masked_name := first_initial || '. ' || last_part;
            ELSE
                -- Single word name: mask middle characters
                -- "Alice" -> "A***e"
                IF LENGTH(NEW.full_name) > 2 THEN
                    NEW.masked_name := 
                        UPPER(LEFT(NEW.full_name, 1)) || 
                        REPEAT('*', LENGTH(NEW.full_name) - 2) || 
                        LOWER(RIGHT(NEW.full_name, 1));
                ELSE
                    -- Very short names, just use as-is
                    NEW.masked_name := NEW.full_name;
                END IF;
            END IF;
        END;
    END IF;
    RETURN NEW;
END;
$function$;
