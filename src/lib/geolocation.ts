/**
 * Geofencing utilities for location-based service booking
 */

export interface Location {
  latitude: number;
  longitude: number;
}

export interface GeofenceCheckResult {
  withinRadius: boolean;
  distance: number; // in kilometers
  error?: string;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if user is within service geofence
 * @param userLocation Current user location
 * @param serviceLocation Service location (lat, lng)
 * @param radiusMeters Radius in meters
 */
export const checkGeofence = (
  userLocation: Location,
  serviceLocation: { latitude: number; longitude: number },
  radiusMeters: number
): GeofenceCheckResult => {
  const distanceKm = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    serviceLocation.latitude,
    serviceLocation.longitude
  );

  const distanceMeters = distanceKm * 1000;
  const withinRadius = distanceMeters <= radiusMeters;

  return {
    withinRadius,
    distance: distanceKm,
  };
};


export const requestLocation = async (): Promise<Location> => {
  if (!navigator.geolocation) {
    throw new Error("Geolocation is not supported by your browser");
  }

  // Helper to wrap getCurrentPosition in a promise
  const getPos = (options: PositionOptions): Promise<Location> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => reject(error),
        options
      );
    });
  };

  try {
    // Single robust attempt with high accuracy enabled but a generous timeout (15s)
    // We also set maximumAge to 10s to allow cached positions if they are recent enough,
    // which speeds up subsequent checks.
    return await getPos({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000
    });
  } catch (error: any) {
    let message = "Unable to access location";
    if (error.code === error.PERMISSION_DENIED) {
      message = "Location permission denied. Please allow location access to book a ticket.";
    } else if (error.code === error.POSITION_UNAVAILABLE) {
      message = "Location information is unavailable. Please check your GPS signal.";
    } else if (error.code === error.TIMEOUT) {
      message = "Location request timed out. Please move to an open area and try again.";
    } else {
      message = error.message || "Unknown location error";
    }
    throw new Error(message);
  }
};
