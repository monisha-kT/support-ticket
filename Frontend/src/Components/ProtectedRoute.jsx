import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useStore from '../store/useStore';
import { CircularProgress, Box } from '@mui/material';

const ProtectedRoute = ({ element, allowedRoles }) => {
  const { user, initializeUser } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        // If we have token but no user, initialize
        if (!user) {
          const { user: userData } = await initializeUser();
          if (userData && allowedRoles.includes(userData.role)) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(allowedRoles.includes(user.role));
        }
      } catch (err) {
        console.error('Auth error:', err);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [user, initializeUser, allowedRoles]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return element;
};

export default ProtectedRoute;
