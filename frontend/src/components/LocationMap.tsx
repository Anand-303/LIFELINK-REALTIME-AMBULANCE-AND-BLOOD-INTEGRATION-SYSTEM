import React, { useMemo, useEffect, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from '../hooks/useGoogleMaps';
import UserLocationMarker from './UserLocationMarker';

interface Location {
  lat: number;
  lng: number;
  id?: string;
  label?: string;
  icon?: string;
  status?: 'available' | 'busy' | 'offline';
}

interface LocationMapProps {
  center?: {
    lat: number;
    lng: number;
  };
  zoom?: number;
  locations?: Location[];
  onMarkerClick?: (location: Location) => void;
  selectedLocation?: Location | null;
  height?: string | number;
  showUserLocation?: boolean;
  userLocation?: {
    lat: number;
    lng: number;
  } | null;
  userLocationAccuracy?: number; // Location accuracy in meters
  onMapLoad?: (map: google.maps.Map) => void;
}

const defaultCenter = {
  lat: 20.5937, // Center of India
  lng: 78.9629
};

const LocationMap: React.FC<LocationMapProps> = ({
  center = defaultCenter,
  zoom = 15,
  locations = [],
  onMarkerClick,
  selectedLocation = null,
  height = '500px',
  showUserLocation = true,
  userLocation = null,
  userLocationAccuracy,
  onMapLoad
}) => {
  // Use the centralized Google Maps hook
  const { isLoaded, loadError, currentLocation } = useGoogleMaps();
  const mapRef = useRef<google.maps.Map | null>(null);
  
  // Prioritize user location for center, then provided center, then current location, then default
  const mapCenter = useMemo(() => {
    if (userLocation) return userLocation;
    if (center && center.lat !== defaultCenter.lat && center.lng !== defaultCenter.lng) return center;
    if (currentLocation) return currentLocation;
    return defaultCenter;
  }, [userLocation, center, currentLocation]);
  
  // Center map on user location when it becomes available
  useEffect(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.setCenter(userLocation);
      mapRef.current.setZoom(15);
    }
  }, [userLocation]);
  
  // Handle map load
  const handleMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    if (onMapLoad) {
      onMapLoad(map);
    }
    // Center on user location if available
    if (userLocation) {
      map.setCenter(userLocation);
      map.setZoom(15);
    }
  };

  const containerStyle = useMemo(() => ({
    width: '100%',
    height: '500px',
    borderRadius: '8px',
    minHeight: '300px', // Ensure minimum height for better UX
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  }), []);

  const mapContainerStyle = useMemo(() => ({
    ...containerStyle,
    height: typeof height === 'number' ? `${height}px` : height
  }), [height]);

  const getMarkerIcon = (location: Location) => {
    if (location.icon) return location.icon;
    
    switch (location.status) {
      case 'available':
        return 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
      case 'busy':
        return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
      case 'offline':
        return 'http://maps.google.com/mapfiles/ms/icons/gray-dot.png';
      default:
        return 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
    }
  };

  if (loadError) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        color: '#d32f2f',
        textAlign: 'center',
        padding: '20px',
        border: '1px solid #ffcdd2'
      }}>
        <div>
          <h3>Error loading map</h3>
          <p>{loadError.message}</p>
          <p>Please check your internet connection and refresh the page.</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
        <p>Loading map...</p>
      </div>
    </div>;
  }

  return (
    <div className="w-full" style={{ position: 'relative' }}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={zoom}
        onLoad={handleMapLoad}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: true,
          mapTypeControl: true,
          fullscreenControl: true,
        }}
      >
        {/* User Location Marker with custom animated icon */}
        {showUserLocation && userLocation && isLoaded && (
          <UserLocationMarker 
            position={userLocation} 
            accuracy={userLocationAccuracy}
          />
        )}

        {/* Ambulance Markers */}
        {locations.map((location) => (
          <Marker
            key={location.id || `${location.lat}-${location.lng}`}
            position={{ lat: location.lat, lng: location.lng }}
            onClick={() => onMarkerClick && onMarkerClick(location)}
            icon={{
              url: getMarkerIcon(location),
              scaledSize: new window.google.maps.Size(32, 32)
            }}
          >
            {(selectedLocation?.id === location.id) && (
              <InfoWindow
                position={{ lat: location.lat, lng: location.lng }}
                onCloseClick={() => onMarkerClick && onMarkerClick(location)}
              >
                <div className="p-2">
                  <h3 className="font-bold text-sm">{location.label || 'Location'}</h3>
                  <p className="text-xs">Lat: {location.lat.toFixed(6)}</p>
                  <p className="text-xs">Lng: {location.lng.toFixed(6)}</p>
                  {location.status && (
                    <div className="mt-1">
                      <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                        location.status === 'available' ? 'bg-green-500' :
                        location.status === 'busy' ? 'bg-red-500' : 'bg-gray-400'
                      }`}></span>
                      <span className="text-xs capitalize">{location.status}</span>
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}
      </GoogleMap>
    </div>
  );
};

export default LocationMap;
