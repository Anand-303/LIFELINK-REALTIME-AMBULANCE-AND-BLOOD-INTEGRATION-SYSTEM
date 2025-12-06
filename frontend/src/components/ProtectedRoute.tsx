import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../redux/hooks';
import { getUserProfile } from '../redux/slices/authSlice';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, token, loading } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const location = useLocation();

  useEffect(() => {
    // If we have a token but no user, fetch the user profile
    if (token && !user && !loading) {
      dispatch(getUserProfile());
    }
  }, [dispatch, token, user, loading]);

  // If no token, redirect to login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If still loading, show loading indicator
  if (loading) {
    return <div>Loading...</div>;
  }

  // If we have role restrictions and the user doesn't have the required role
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // If all checks pass, render the children
  return <>{children}</>;
};

export default ProtectedRoute;