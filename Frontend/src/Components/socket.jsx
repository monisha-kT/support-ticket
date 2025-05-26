import { useState, useEffect } from 'react';
import io from 'socket.io-client';

let socket = null;
let connectionPromise = null;

export const validateToken = async (token) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/validate', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Token validation failed:', error);
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
      reject(new Error('Socket connection timed out'));
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
      reject(new Error('Socket connection failed'));
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error.message);
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

  if (!connectionPromise) {
    connectionPromise = initSocket().finally(() => {
      connectionPromise = null;
    });
  }

  try {
    socket = await connectionPromise;
    return socket;
  } catch (error) {
    console.error('Failed to get socket:', error);
    return null;
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let socketInstance = null;

    const initializeSocket = async () => {
      try {
        socketInstance = await getSocket();
        if (!socketInstance) {
          setError('Failed to initialize socket: No valid token');
          setIsConnected(false);
          return;
        }

        setError(null);
        setIsConnected(socketInstance.connected);

        socketInstance.on('connect', () => {
          setIsConnected(true);
          setError(null);
        });

        socketInstance.on('disconnect', () => {
          setIsConnected(false);
          setError('Socket disconnected');
        });

        socketInstance.on('error', (err) => {
          setError(err.message || 'Socket error');
          setIsConnected(false);
        });

        socketInstance.on('connect_error', (err) => {
          setError(err.message || 'Connection error');
          setIsConnected(false);
        });
      } catch (err) {
        setError(err.message || 'Failed to initialize socket');
        setIsConnected(false);
      }
    };

    initializeSocket();

    return () => {
      if (socketInstance) {
        socketInstance.off('connect');
        socketInstance.off('disconnect');
        socketInstance.off('error');
        socketInstance.off('connect_error');
        // Do not disconnect here to maintain singleton across components
      }
    };
  }, []);

  return { isConnected, error };
};