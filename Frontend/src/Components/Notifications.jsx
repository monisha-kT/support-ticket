import React, { useState, useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { getSocket } from './socket';

function Notifications() {
  const [notification, setNotification] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Listen for ticket acceptance
    socket.on('ticket_accepted', (data) => {
      setNotification({
        type: 'success',
        message: `Your ticket #${data.ticket_id} has been accepted! You can now start chatting.`
      });
      setOpen(true);
    });

    // Listen for ticket rejection
    socket.on('ticket_rejected', (data) => {
      setNotification({
        type: 'info',
        message: `Your ticket #${data.ticket_id} has been rejected. Please try submitting a new ticket.`
      });
      setOpen(true);
    });

    // Clean up listeners
    return () => {
      socket.off('ticket_accepted');
      socket.off('ticket_rejected');
    };
  }, []);

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  if (!notification) return null;

  
}

export default Notifications;
