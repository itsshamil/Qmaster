-- Add geofencing to all services
-- Using coordinates: 11.3152999, 75.9376285 (appears to be Kochi, India)
-- With 1000m radius (1km)

UPDATE public.services
SET 
  location_lat = 11.3152999,
  location_long = 75.9376285,
  radius_meters = 1000
WHERE location_lat IS NULL OR location_long IS NULL OR radius_meters IS NULL;

-- Verify the update
SELECT id, name, location_lat, location_long, radius_meters FROM public.services;
