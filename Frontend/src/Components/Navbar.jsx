import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import NotificationDrawer from './NotificationDrawer';
import { getSocket, disconnectSocket } from './socket';
import UserProfile from './UserProfile';
import HomeIcon from '@mui/icons-material/Home';

function Navbar() {
  const navigate = useNavigate();
  const { user, setUser } = useStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newTickets, setNewTickets] = useState(0);
  const [notifications, setNotifications] = useState([]);

  // Fetch new tickets count
  const fetchNewTicketsCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token available');

      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch tickets');

      const data = await res.json();
      const openCount = data.filter((ticket) => ticket.status === 'open').length;
      setNewTickets(openCount);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setNotifications((prev) => [
        ...prev,
        { type: 'error', message: `Failed to fetch tickets: ${err.message}` },
      ]);
      if (err.message.includes('No token') || err.message.includes('Unauthorized')) {
        handleLogout();
      }
    }
  };

  // Initialize socket for ticket updates and reassignment notifications
  useEffect(() => {
    if (!user || user.role !== 'member') return;

    let socketInstance = null;

    const initializeSocket = async () => {
      try {
        socketInstance = await getSocket();
        if (!socketInstance) {
          console.error('Socket initialization failed');
          setNotifications((prev) => [
            ...prev,
            { type: 'error', message: 'Failed to initialize socket connection' },
          ]);
          handleLogout(); // Logout if token is invalid
          return;
        }

        const handleSocketConnect = () => {
          console.log('Attaching socket listeners in Navbar');
          socketInstance.on('reassignment_notification', (data) => {
            setNotifications((prev) => [
              ...prev,
              {
                type: 'info',
                message: data.message,
                ticketId: data.ticket_id,
                category: data.category,
                priority: data.priority,
              },
            ]);
          });

          socketInstance.on('ticket_status_update', () => {
            fetchNewTicketsCount();
            setNotifications((prev) => [
              ...prev,
              { type: 'info', message: 'Ticket status updated.' },
            ]);
          });

          socketInstance.on('ticket_reassigned', async ({ ticket_id, reassigned_to }) => {
            try {
              const token = localStorage.getItem('token');
              const res = await fetch(`http://localhost:5000/api/users/me`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) throw new Error('Failed to fetch user');
              const userData = await res.json();
              if (userData.id === reassigned_to) {
                setNotifications((prev) => [
                  ...prev,
                  {
                    type: 'info',
                    message: `Ticket #${ticket_id} has been reassigned to you.`,
                  },
                ]);
                fetchNewTicketsCount();
              }
            } catch (err) {
              console.error('Error fetching user:', err);
              setNotifications((prev) => [
                ...prev,
                { type: 'error', message: `Error fetching user: ${err.message}` },
              ]);
              if (err.message.includes('Unauthorized')) {
                handleLogout();
              }
            }
          });

          socketInstance.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
            setNotifications((prev) => [
              ...prev,
              { type: 'error', message: `Socket error: ${err.message}` },
            ]);
          });
        };

        if (socketInstance.connected) {
          handleSocketConnect();
        } else {
          socketInstance.on('connect', handleSocketConnect);
        }
      } catch (err) {
        console.error('Socket initialization error:', err);
        setNotifications((prev) => [
          ...prev,
          { type: 'error', message: `Socket initialization failed: ${err.message}` },
        ]);
        handleLogout();
      }
    };

    initializeSocket();
    fetchNewTicketsCount();

    return () => {
      if (socketInstance) {
        socketInstance.off('reassignment_notification');
        socketInstance.off('ticket_status_update');
        socketInstance.off('ticket_reassigned');
        socketInstance.off('connect_error');
        socketInstance.off('connect');
      }
    };
  }, [user]);

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
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, fontWeight: 'bold', font: 'Times New Roman' }}
          >
            Support Chat
          </Typography>
          <IconButton
  color="inherit"
  onClick={() => navigate('/dashboard')}
  sx={{
    mr: 1,
    '&:hover': {
      bgcolor: 'rgba(255, 255, 255, 0.1)',
    },
  }}
  title="Home"
>
  <HomeIcon />
</IconButton>
          {user.role === 'member' && (
            <IconButton
              color="inherit"
              onClick={() => setDrawerOpen(true)}
              sx={{
                mr: 2,
                position: 'relative',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <Badge
                badgeContent={newTickets}
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    bgcolor: '#DC3545',
                    color: 'white',
                  },
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