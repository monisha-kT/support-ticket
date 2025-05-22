import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { CircularProgress, Box } from '@mui/material';

const ProtectedRoute = ({ element, allowedRoles }) => {
  const { user, initializeUser } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token && !user) {
        const userData = await initializeUser();
        setIsAuthenticated(userData && allowedRoles.includes(userData.role));
      } else {
        setIsAuthenticated(user && allowedRoles.includes(user.role));
      }
      setIsLoading(false);
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

  return isAuthenticated ? element : <Navigate to="/auth" replace />;
};

export default ProtectedRoute;