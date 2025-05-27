import { useState, useEffect } from 'react';
import io from 'socket.io-client';

let socket = null;
let connectionPromise = null;

export const validateToken = async (token) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/validate', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      console.warn('Token validation failed:', response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Token validation error:', err.message);
    return false;
  }
};

const initSocket = async () => {
  if (socket && socket.connected) {
    console.log('Socket already connected:', socket.id);
    return socket;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No token available for socket connection');
    return null;
  }

  const isValid = await validateToken(token);
  if (!isValid) {
    console.warn('Invalid token, clearing auth data');
    return null;
  }

  socket = io('http://localhost:5000', {
    query: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.disconnect();
      socket = null;
      reject(new Error('Socket connection timed out after 15 seconds'));
    }, 15000);

    socket.on('connect', () => {
      clearTimeout(timeoutId);
      console.log('Socket connected:', socket.id);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeoutId);
      console.error('Socket connection error:', error.message);
      socket = null;
      reject(new Error(`Socket connection failed: ${error.message}`));
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error.message || error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      socket = null;
    });
  });
};

export const getSocket = async () => {
  if (socket && socket.connected) {
    return socket;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = initSocket().finally(() => {
    connectionPromise = null;
  });

  try {
    socket = await connectionPromise;
    return socket;
  } catch (error) {
    console.error('Failed to get socket:', error.message);
    return null;
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.off('connect');
    socket.off('connect_error');
    socket.off('error');
    socket.off('disconnect');
    socket.disconnect();
    console.log('Socket disconnected');
    socket = null;
  }
};

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket?.connected || false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeSocket = async () => {
      try {
        const socketInstance = await getSocket();
        if (!socketInstance) {
          setError('Failed to initialize socket: No valid token or connection failed');
          setIsConnected(false);
          return;
        }

        setIsConnected(socketInstance.connected);
        setError(null);

        socketInstance.on('connect', () => {
          setIsConnected(true);
          setError(null);
        });

        socketInstance.on('disconnect', (reason) => {
          setIsConnected(false);
          setError(`Socket disconnected: ${reason}`);
        });

        socketInstance.on('error', (err) => {
          setError(err.message || 'Socket error');
          setIsConnected(false);
        });

        socketInstance.on('connect_error', (err) => {
          setError(err.message || 'Connection error');
          setIsConnected(false);
        });

        return () => {
          socketInstance.off('connect');
          socketInstance.off('disconnect');
          socketInstance.off('error');
          socketInstance.off('connect_error');
        };
      } catch (err) {
        setError(err.message || 'Failed to initialize socket');
        setIsConnected(false);
      }
    };

    initializeSocket();
  }, []);

  return { isConnected, error };
};