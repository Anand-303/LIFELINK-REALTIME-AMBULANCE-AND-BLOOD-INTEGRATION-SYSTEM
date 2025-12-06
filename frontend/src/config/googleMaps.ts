// Google Maps configuration for @react-google-maps/api
const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyDV7rbMIPsOFx2IIIF8Qya5IsPp9tAJbNY';

export const googleMapsConfig = {
  googleMapsApiKey: apiKey,
  libraries: ['places', 'geometry'] as const,
  id: 'google-map-script',
  version: 'weekly',
  language: 'en',
  region: 'US'
} as const;

// This ensures we only load the Google Maps script once
declare global {
  interface Window {
    googleMapsInitialized?: boolean;
  }
}

export const initializeGoogleMaps = () => {
  if (typeof window !== 'undefined' && !window.googleMapsInitialized) {
    window.googleMapsInitialized = true;
    return true;
  }
  return false;
};
