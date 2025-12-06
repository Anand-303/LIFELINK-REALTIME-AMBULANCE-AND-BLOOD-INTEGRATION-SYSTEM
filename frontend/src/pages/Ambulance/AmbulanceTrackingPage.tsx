import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import Grid from '../../components/CustomGrid';
import { Container, Paper, Typography, Box, Button, TextField, FormControl, InputLabel, Select, MenuItem, FormHelperText, Divider, List, ListItem, ListItemText, ListItemIcon, Avatar, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, CircularProgress, Card, CardContent, CardActions, Chip, useTheme, useMediaQuery, Alert, Snackbar } from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import MyLocationIcon from '@mui/icons-material/MyLocation';

import LocationMap from '../../components/LocationMap';
import { useAppSelector } from '../../redux/hooks';
import api, { ambulanceService } from '../../services/api';
import { Ambulance, AmbulanceRequest } from '../../types';
import { useSocket } from '../../hooks/useSocket';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';

// Local Location type for the map component
interface MapLocation {
  lat: number;
  lng: number;
  id: string;
  label: string;
  status: 'available' | 'busy' | 'offline' | undefined;
}

// Map container style
const mapContainerStyle = {
  width: '100%',
  height: '500px',
};

// Map options
const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: true,
  mapTypeControl: true,
};

const AmbulanceTrackingPage: React.FC = () => {
  // Initialize hooks at the top level
  const { user } = useAppSelector(state => state.auth);
  const isMounted = useRef(true);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Use the centralized Google Maps hook
  const { 
    isLoaded: mapsLoaded, 
    loadError: mapsError, 
    currentLocation, 
    getCurrentLocation,
    getAddressFromCoordinates
  } = useGoogleMaps();
  
  // State for map and UI
  const [center, setCenter] = useState(() => ({
    lat: 20.5937, 
    lng: 78.9629  // Default to India center
  }));
  
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocationAccuracy, setUserLocationAccuracy] = useState<number | undefined>(undefined);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedAmbulance, setSelectedAmbulance] = useState<Ambulance | null>(null);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  
  // Custom hooks
  const { socket, subscribeToAmbulanceUpdates } = useSocket();
  
  // Get user location with better error handling
  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0, // Always get fresh location
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(pos);
        setCenter(pos);
        setUserLocationAccuracy(position.coords.accuracy);
        setLocationError(null);
        setLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        let errorMessage = 'Unable to get your location. ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Please allow location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage += 'An unknown error occurred.';
            break;
        }
        setLocationError(errorMessage);
        setLoading(false);
      },
      options
    );
  }, []);

  // Watch user location for real-time updates
  const watchUserLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000, // Accept cached location if less than 5 seconds old
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(pos);
        setUserLocationAccuracy(position.coords.accuracy);
        setLocationError(null);
      },
      (error) => {
        console.error('Error watching location:', error);
        // Don't show error for watch failures, just log them
      },
      options
    );
  }, []);

  // Initialize user location when maps are loaded
  useEffect(() => {
    if (mapsError) {
      console.error('Error loading Google Maps:', mapsError);
      setError('Failed to load Google Maps. Please check your API key and try again.');
      setLoading(false);
      return;
    }

    if (mapsLoaded) {
      // Request initial location
      requestUserLocation();
      // Start watching for location updates
      watchUserLocation();
      setLoading(false);
    }

    // Cleanup watch on unmount
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [mapsLoaded, mapsError, requestUserLocation, watchUserLocation]);

  // Update center when currentLocation from hook changes
  useEffect(() => {
    if (currentLocation && !userLocation) {
      setUserLocation(currentLocation);
      setCenter(currentLocation);
    }
  }, [currentLocation, userLocation]);
  
  // State for ambulance request
  const [openRequestDialog, setOpenRequestDialog] = useState(false);
  const [requestLocation, setRequestLocation] = useState('');
  const [requestUseCurrentLocation, setRequestUseCurrentLocation] = useState<boolean>(false);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [requestDetails, setRequestDetails] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [userRequests, setUserRequests] = useState<AmbulanceRequest[]>([]);
  
  // Refs
  const mapRef = useRef<google.maps.Map | null>(null);
  
  // Load ambulances
  const loadAmbulances = useCallback(async () => {
    try {
      const response = await ambulanceService.getAllAmbulances();
      setAmbulances(response?.data || []);
    } catch (err) {
      console.error('Error loading ambulances:', err);
      setError('Failed to load ambulances. Please try again.');
      setAmbulances([]); // Ensure ambulances is always an array
    }
  }, [user]);
  
  // Load user requests
  const loadUserRequests = useCallback(async () => {
    if (!user) {
      setUserRequests([]);
      return;
    }
    
    try {
      const response = await ambulanceService.getUserAmbulanceRequests();
      setUserRequests(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      console.error('Error loading user requests:', err);
      setUserRequests([]);
    }
  }, [user]);
  
  // Load ambulances and user requests
  useEffect(() => {
    if (!mapsLoaded) return;

    loadAmbulances();
    
    if (user) {
      loadUserRequests();
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [mapsLoaded, loadAmbulances, loadUserRequests, user]);
  
  // Subscribe to real-time ambulance updates
  useEffect(() => {
    if (socket) {
      const unsubscribe = subscribeToAmbulanceUpdates((updatedAmbulance) => {
        setAmbulances(prev => {
          const index = prev.findIndex(amb => amb._id === updatedAmbulance._id);
          if (index !== -1) {
            const newAmbulances = [...prev];
            newAmbulances[index] = updatedAmbulance;
            return newAmbulances;
          }
          return [...prev, updatedAmbulance];
        });
      });
      
      return () => {
        unsubscribe();
      };
    }
  }, [socket, subscribeToAmbulanceUpdates]);
  
  // Handle marker click
  const handleMarkerClick = (location: any) => {
    const ambulance = ambulances.find(a => a._id === location.id);
    setSelectedAmbulance(ambulance || null);
  };

  // Convert ambulances to locations format
  const ambulanceLocations = ambulances.map(ambulance => {
    let status: 'available' | 'busy' | 'offline' | undefined = 'offline';
    
    if (ambulance.status === 'available' || ambulance.status === 'busy') {
      status = ambulance.status;
    } else if (ambulance.status === 'maintenance') {
      status = 'offline';
    }
    
    return {
      lat: ambulance.location?.latitude || 0,
      lng: ambulance.location?.longitude || 0,
      id: ambulance._id,
      label: `Ambulance ${ambulance.registrationNumber}`,
      status
    } as MapLocation;
  });

  if (mapsError) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Error loading Google Maps. Please check your API key and try again.
        </Alert>
      </Container>
    );
  }
  
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Ambulance Tracking
      </Typography>
      
      <Grid container spacing={4}>
        {/* Map Section */}
        <Grid item xs={12} md={8} component="div" sx={{ display: 'flex', flexDirection: 'column' }}>
          <Paper sx={{ p: 2, mb: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Ambulance Tracking
            </Typography>
            {locationError && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {locationError}
                <Button 
                  size="small" 
                  onClick={requestUserLocation}
                  sx={{ ml: 2 }}
                >
                  Try Again
                </Button>
              </Alert>
            )}
            <Box sx={{ height: '70vh', borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
              <LocationMap
                center={userLocation || center}
                zoom={userLocation ? 15 : 10}
                locations={ambulanceLocations}
                onMarkerClick={handleMarkerClick}
                selectedLocation={selectedAmbulance ? {
                  lat: selectedAmbulance.location?.latitude || 0,
                  lng: selectedAmbulance.location?.longitude || 0,
                  id: selectedAmbulance._id,
                  label: `Ambulance ${selectedAmbulance.registrationNumber}`,
                  status: selectedAmbulance.status === 'maintenance' ? 'offline' : 
                          (selectedAmbulance.status === 'available' || selectedAmbulance.status === 'busy') ? 
                          selectedAmbulance.status : 'offline'
                } : null}
                height="100%"
                userLocation={userLocation}
                userLocationAccuracy={userLocationAccuracy}
                showUserLocation={true}
              />
            </Box>
          </Paper>
        </Grid>
        
        {/* Ambulance Details Sidebar */}
        <Grid item xs={12} md={4} component="div" sx={{ display: 'flex', flexDirection: 'column' }}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Ambulance Details
            </Typography>
            {selectedAmbulance ? (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  {selectedAmbulance.registrationNumber}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Driver:</strong> {selectedAmbulance.driver?.name || 'N/A'}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Phone:</strong> {selectedAmbulance.driver?.phone || 'N/A'}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Status:</strong> {selectedAmbulance.status || 'N/A'}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="textSecondary">
                Select an ambulance to view details
              </Typography>
            )}
            <Button
              variant="contained"
              color="primary"
              fullWidth
              startIcon={<MyLocationIcon />}
              onClick={requestUserLocation}
              sx={{ mb: 1, borderRadius: '20px' }}
            >
              {userLocation ? 'Update My Location' : 'Get My Location'}
            </Button>
            {userLocation && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="caption" color="textSecondary" display="block">
                  Your Location:
                </Typography>
                <Typography variant="body2" gutterBottom>
                  Lat: {userLocation.lat.toFixed(6)}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  Lng: {userLocation.lng.toFixed(6)}
                </Typography>
                {userLocationAccuracy && (
                  <Typography variant="caption" color="textSecondary">
                    Accuracy: ±{Math.round(userLocationAccuracy)}m
                  </Typography>
                )}
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Action Section */}
        <Grid item xs={12} md={4} component="div" sx={{ display: 'flex', flexDirection: 'column' }}>
          <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Request Ambulance
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Need emergency medical transportation? Request an ambulance to your location.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              startIcon={<DirectionsCarIcon />}
              onClick={() => setOpenRequestDialog(true)}
              sx={{ mt: 2 }}
            >
              Request Now
            </Button>
          </Paper>
        </Grid>
        
        {/* Recent Requests Section */}
        <Grid item xs={12} component="div" sx={{ display: 'flex', flexDirection: 'column' }}>
          <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Your Recent Requests
            </Typography>
            
            {!userRequests || userRequests.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                You don't have any ambulance requests yet.
              </Typography>
            ) : (
              <List>
                {(userRequests || []).slice(0, 5).map((request, index) => (
                  <React.Fragment key={request._id}>
                    {index > 0 && <Divider component="li" />}
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle1">
                              {request.pickupLocation.address}
                            </Typography>
                            <Chip 
                              label={request.status} 
                              size="small" 
                              color={
                                request.status === 'pending' ? 'warning' :
                                request.status === 'accepted' ? 'success' :
                                request.status === 'cancelled' ? 'error' : 'default'
                              }
                            />
                          </Box>
                        }
                        secondary={
                          <React.Fragment>
                            <Typography variant="body2" color="textSecondary">
                              {new Date(request.createdAt).toLocaleString()}
                            </Typography>
                            {(request as any).destination?.address || request.destinationLocation ? (
                              <Typography variant="body2">
                                To: {(request as any).destination?.address || request.destinationLocation?.address}
                              </Typography>
                            ) : null}
                          </React.Fragment>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* Request Dialog */}
      <Dialog open={openRequestDialog} onClose={() => setOpenRequestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request an Ambulance</DialogTitle>
        <DialogContent>
          {requestSuccess ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              Your ambulance request has been submitted successfully!
            </Alert>
          ) : (
            <Box sx={{ mt: 2 }}>
              <TextField
                label="Patient Name"
                fullWidth
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                label="Patient Phone"
                fullWidth
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                margin="normal"
              />
              <TextField
                label="Pickup Location Address"
                fullWidth
                value={requestLocation}
                onChange={(e) => setRequestLocation(e.target.value)}
                margin="normal"
                required
                helperText="Enter pickup address, or enable 'Use my current map location'"
              />
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <input
                  type="checkbox"
                  checked={requestUseCurrentLocation}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRequestUseCurrentLocation(checked);
                    if (checked && userLocation && !requestLocation && getAddressFromCoordinates) {
                      getAddressFromCoordinates(userLocation.lat, userLocation.lng)
                        .then(addr => {
                          if (addr && !requestLocation) setRequestLocation(addr);
                        })
                        .catch(() => {
                          // ignore reverse geocode failure
                        });
                    }
                  }}
                  style={{ marginRight: 8 }}
                  id="use-current-location"
                />
                <label htmlFor="use-current-location">Use my current map location</label>
              </Box>
              <TextField
                label="Destination Address (optional)"
                fullWidth
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                margin="normal"
              />
              <TextField
                label="Additional Details"
                fullWidth
                value={requestDetails}
                onChange={(e) => setRequestDetails(e.target.value)}
                margin="normal"
                multiline
                rows={4}
                helperText="Describe the emergency situation (optional)"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpenRequestDialog(false)}
            color="primary"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              try {
                setRequestLoading(true);
                if (!patientName || !requestLocation && !requestUseCurrentLocation) {
                  setError('Please provide patient name and pickup location.');
                  setRequestLoading(false);
                  return;
                }

                // Resolve pickup coordinates and address
                let pickupAddress = requestLocation;
                let pickupLatLng: { lat: number; lng: number } | null = null;

                if (requestUseCurrentLocation && userLocation) {
                  pickupLatLng = userLocation;
                  if (!pickupAddress && getAddressFromCoordinates) {
                    try {
                      const addr = await getAddressFromCoordinates(userLocation.lat, userLocation.lng);
                      if (addr) pickupAddress = addr;
                    } catch {
                      // ignore
                    }
                  }
                  if (!pickupAddress) {
                    pickupAddress = `Lat ${userLocation.lat.toFixed(6)}, Lng ${userLocation.lng.toFixed(6)}`;
                  }
                } else {
                  // Geocode typed address
                  try {
                    const geocoder = new (window as any).google.maps.Geocoder();
                    const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
                      geocoder.geocode(
                        { address: requestLocation },
                        (res: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
                          if (status === 'OK' && res) resolve(res);
                          else reject(status);
                        }
                      );
                    });
                    if (results && results[0] && results[0].geometry) {
                      const loc = results[0].geometry.location;
                      pickupLatLng = { lat: loc.lat(), lng: loc.lng() };
                      pickupAddress = results[0].formatted_address || pickupAddress;
                    }
                  } catch (e) {
                    // If geocoding fails, continue with no coords
                  }
                }

                // Destination (optional)
                let destinationPayload: { address: string; latitude?: number; longitude?: number } | undefined;
                if (destinationAddress) {
                  destinationPayload = { address: destinationAddress };
                  try {
                    const geocoder = new (window as any).google.maps.Geocoder();
                    const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
                      geocoder.geocode(
                        { address: destinationAddress },
                        (res: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
                          if (status === 'OK' && res) resolve(res);
                          else reject(status);
                        }
                      );
                    });
                    if (results && results[0] && results[0].geometry) {
                      const loc = results[0].geometry.location;
                      destinationPayload.latitude = loc.lat();
                      destinationPayload.longitude = loc.lng();
                      destinationPayload.address = results[0].formatted_address || destinationPayload.address;
                    }
                  } catch {
                    // ignore geocode failure, keep address only
                  }
                }

                if (!pickupLatLng) {
                  setError('Could not resolve pickup coordinates. Please enable location or enter a valid address.');
                  setRequestLoading(false);
                  return;
                }

                // Submit request
                await ambulanceService.createAmbulanceRequest({
                  patientName,
                  patientPhone,
                  pickupLocation: {
                    address: pickupAddress,
                    latitude: pickupLatLng.lat,
                    longitude: pickupLatLng.lng,
                  },
                  destination: destinationPayload,
                  emergencyDetails: requestDetails,
                });

                setRequestSuccess(true);
                setOpenRequestDialog(false);
                await loadUserRequests();
              } catch (err) {
                console.error('Error submitting request:', err);
                setError('Failed to submit request. Please try again.');
              } finally {
                setRequestLoading(false);
              }
            }}
            color="primary"
            variant="contained"
            disabled={requestLoading || requestSuccess}
          >
            {requestLoading ? <CircularProgress size={24} /> : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AmbulanceTrackingPage;