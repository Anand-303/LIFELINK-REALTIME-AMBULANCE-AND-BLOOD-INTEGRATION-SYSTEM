import { useState, useCallback, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { googleMapsConfig } from '../config/googleMaps';

// This is now the single place where Google Maps is loaded
export const useGoogleMaps = () => {
  // First, load the Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: googleMapsConfig.id,
    googleMapsApiKey: googleMapsConfig.googleMapsApiKey,
    libraries: [...googleMapsConfig.libraries],
    language: googleMapsConfig.language,
    region: googleMapsConfig.region,
    version: googleMapsConfig.version
  });

  // Then, manage location state
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const apiKey = googleMapsConfig.googleMapsApiKey;

  // Get current location
  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationError(null);
        },
        (error) => {
          setLocationError(`Error getting location: ${error.message}`);
          console.error('Error getting current location:', error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } else {
      setLocationError('Geolocation is not supported by this browser.');
    }
  }, []);

  // Get address from coordinates (reverse geocoding)
  const getAddressFromCoordinates = useCallback(
    async (lat: number, lng: number): Promise<string> => {
      if (!isLoaded) return 'Maps API not loaded';

      try {
        const geocoder = new window.google.maps.Geocoder();
        const response = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results) {
              resolve(results);
            } else {
              reject(status);
            }
          });
        });

        if (response && response[0]) {
          return response[0].formatted_address;
        }
        return 'Address not found';
      } catch (error) {
        console.error('Error in reverse geocoding:', error);
        return 'Error getting address';
      }
    },
    [isLoaded]
  );

  // Get coordinates from address (geocoding)
  const getCoordinatesFromAddress = useCallback(
    async (address: string): Promise<{ lat: number; lng: number } | null> => {
      if (!isLoaded) return null;

      try {
        const geocoder = new window.google.maps.Geocoder();
        const response = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results) {
              resolve(results);
            } else {
              reject(status);
            }
          });
        });

        if (response && response[0] && response[0].geometry) {
          const location = response[0].geometry.location;
          return {
            lat: location.lat(),
            lng: location.lng(),
          };
        }
        return null;
      } catch (error) {
        console.error('Error in geocoding:', error);
        return null;
      }
    },
    [isLoaded]
  );

  // Calculate distance between two points
  const calculateDistance = useCallback(
    (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<number> => {
      return new Promise((resolve, reject) => {
        if (!isLoaded) {
          reject('Maps API not loaded');
          return;
        }

        const service = new window.google.maps.DistanceMatrixService();
        service.getDistanceMatrix(
          {
            origins: [new window.google.maps.LatLng(origin.lat, origin.lng)],
            destinations: [new window.google.maps.LatLng(destination.lat, destination.lng)],
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (response, status) => {
            if (status === 'OK' && response) {
              const distance = response.rows[0].elements[0].distance.value; // in meters
              resolve(distance);
            } else {
              reject(`Error calculating distance: ${status}`);
            }
          }
        );
      });
    },
    [isLoaded]
  );

  // Get current location on component mount
  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  return {
    isLoaded,
    loadError,
    currentLocation,
    locationError,
    getCurrentLocation,
    apiKey,
    getAddressFromCoordinates,
    getCoordinatesFromAddress,
    calculateDistance,
  };
};