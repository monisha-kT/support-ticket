import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Badge,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import { getSocket } from './socket';

function NotificationDrawer({ open, onClose }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      fetchOpenTickets();
    }
  }, [open]);

  const fetchOpenTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!res.ok) throw new Error('Failed to fetch tickets');
      
      const data = await res.json();
      // Filter only open tickets
      const openTickets = data.filter(ticket => ticket.status === 'open');
      setTickets(openTickets);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/accept/${ticketId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to accept ticket');
      
      await fetchOpenTickets();
      onClose(); // Close drawer after accepting
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/reject/${ticketId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to reject ticket');
      
      await fetchOpenTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: 350 }
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">New Tickets</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        ) : tickets.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
            No new tickets available
          </Typography>
        ) : (
          <List>
            {tickets.map((ticket) => (
              <React.Fragment key={ticket.id}>
                <ListItem
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 1
                  }}
                >
                  <ListItemText
                    primary={`Ticket #${ticket.id}`}
                    secondary={
                      <>
                        <Typography variant="body2" component="span" display="block">
                          Category: {ticket.category}
                        </Typography>
                        <Typography variant="body2" component="span" display="block">
                          Urgency: {ticket.urgency}
                        </Typography>
                        <Typography variant="body2" component="span" display="block">
                          Description: {ticket.description}
                        </Typography>
                      </>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', width: '100%' }}>
                    <Button
                      startIcon={<ThumbUpIcon />}
                      onClick={() => handleAcceptTicket(ticket.id)}
                      color="success"
                      variant="outlined"
                      size="small"
                    >
                      Accept
                    </Button>
                    <Button
                      startIcon={<ThumbDownIcon />}
                      onClick={() => handleRejectTicket(ticket.id)}
                      color="error"
                      variant="outlined"
                      size="small"
                    >
                      Reject
                    </Button>
                  </Box>
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
}

export default NotificationDrawer;
