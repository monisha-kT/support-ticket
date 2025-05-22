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
import { getSocket } from './socket';
import UserProfile from './UserProfile';

function Navbar() {
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newTickets, setNewTickets] = useState(0);

  // Listen for new tickets and updates
  useEffect(() => {
    if (user?.role === 'member') {
      fetchNewTicketsCount();

      const socket = getSocket();
      if (socket) {
        socket.on('ticket_status_update', () => {
          fetchNewTicketsCount();
        });

        return () => {
          socket.off('ticket_status_update');
        };
      }
    }
  }, [user]);

  const fetchNewTicketsCount = async () => {
    try {
      const token = localStorage.getItem('token');
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
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/auth');
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    fetchNewTicketsCount();
  };

  return (
    <>
      <AppBar 
        position="fixed"
        sx={{
          bgcolor: '#128C7E' // WhatsApp green color
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' ,fontFamily:'times new roman'}}>
            Support Chat
          </Typography>
          
          {user?.role === 'member' && (
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
          
          <Button 
            color="inherit"
           
           
            sx={{
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            <UserProfile />
          </Button>
        </Toolbar>
      </AppBar>

      {user?.role === 'member' && (
        <NotificationDrawer 
          open={drawerOpen} 
          onClose={handleDrawerClose}
        />
      )}
    </>
  );
}

export default Navbar;
