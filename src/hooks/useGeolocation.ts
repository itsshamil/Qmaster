import { useState, useCallback } from 'react';
import { requestLocation, checkGeofence, type Location, type GeofenceCheckResult } from '@/lib/geolocation';

interface UseGeolocationResult {
  location: Location | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<{ location: Location | null; error: string | null }>;
  checkGeofence: (serviceLocation: { latitude: number; longitude: number }, radiusMeters: number) => Promise<GeofenceCheckResult | null>;
}

/**
 * Hook to manage geolocation requests and geofence checks
 */
export const useGeolocation = (): UseGeolocationResult => {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestLocation = useCallback(async (): Promise<{ location: Location | null; error: string | null }> => {
    setLoading(true);
    setError(null);

    try {
      const userLocation = await requestLocation();
      setLocation(userLocation);
      return { location: userLocation, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get location';
      setError(message);
      return { location: null, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCheckGeofence = useCallback(
    async (
      serviceLocation: { latitude: number; longitude: number },
      radiusMeters: number
    ): Promise<GeofenceCheckResult | null> => {
      // If we already have location, use it
      if (location) {
        return checkGeofence(location, serviceLocation, radiusMeters);
      }

      // Otherwise, request location first
      const { location: userLocation, error } = await handleRequestLocation();
      if (!userLocation) {
        return {
          withinRadius: false,
          distance: 0,
          error: error || "Location access failed. Please check permissions."
        };
      }

      return checkGeofence(userLocation, serviceLocation, radiusMeters);
    },
    [location, handleRequestLocation]
  );

  return {
    location,
    loading,
    error,
    requestLocation: handleRequestLocation,
    checkGeofence: handleCheckGeofence,
  };
};
