import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Badge
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import NotificationDrawer from './NotificationDrawer';
import { getSocket, disconnectSocket } from './socket';
import UserProfile from './UserProfile';

function Navbar() {
  const navigate = useNavigate();
  const { user, setUser } = useStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newTickets, setNewTickets] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [socketInitialized, setSocketInitialized] = useState(false);

  // Initialize socket and listen for ticket updates
  useEffect(() => {
    if (user?.role !== 'member') return;

    let socket = null;

    const initializeSocket = async () => {
      try {
        socket = await getSocket();
        if (socket) {
          setSocketInitialized(true);
          socket.on('ticket_status_update', () => {
            fetchNewTicketsCount();
            setNotifications(prev => [
              ...prev,
              { type: 'info', message: 'Ticket status updated.' }
            ]);
          });
          socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
          });
        }
      } catch (err) {
        console.error('Failed to initialize socket:', err);
      }
    };

    fetchNewTicketsCount();
    initializeSocket();

    return () => {
      if (socket) {
        socket.off('ticket_status_update');
        socket.off('connect_error');
      }
    };
  }, [user]);

  const fetchNewTicketsCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token available');

      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch tickets');

      const data = await res.json();
      const openCount = data.filter(ticket => ticket.status === 'open').length;
      setNewTickets(openCount);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setNotifications(prev => [
        ...prev,
        { type: 'error', message: `Failed to fetch tickets: ${err.message}` }
      ]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    disconnectSocket();
    navigate('/auth');
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setNotifications([]); // Clear notifications on close
    fetchNewTicketsCount();
  };

  if (!user) return null;

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          bgcolor: '#128C7E', // WhatsApp green color
          zIndex: (theme) => theme.zIndex.drawer + 1
        }}
      >
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, fontWeight: 'bold', fontFamily: 'Times New Roman' }}
          >
            Support Chat
          </Typography>

          {user.role === 'member' && (
            <IconButton
              color="inherit"
              onClick={() => setDrawerOpen(true)}
              sx={{
                mr: 2,
                position: 'relative',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              <Badge
                badgeContent={newTickets}
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    bgcolor: '#DC3545',
                    color: 'white'
                  }
                }}
              >
                <NotificationsIcon />
              </Badge>
            </IconButton>
          )}

          <UserProfile />

        </Toolbar>
      </AppBar>

      {user.role === 'member' && (
        <NotificationDrawer
          open={drawerOpen}
          onClose={handleDrawerClose}
          notifications={notifications}
        />
      )}
    </>
  );
}

export default Navbar;