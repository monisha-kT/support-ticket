import React, { useState, useEffect } from 'react';
import {
  Box, Typography, CircularProgress, Alert, List, ListItem, ListItemText,
  Divider, Chip, Button, Paper, Avatar, Badge
} from '@mui/material';
import { Chat } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import ChatWindow from './ChatWindow';

function UserTicketsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth');
      return;
    }

    fetchTickets();
  }, [navigate]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch tickets');

      const data = await res.json();
      setTickets(data.filter(ticket => ticket.user_id === user.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketSelect = async (ticket) => {
    try {
      if (ticket.status !== 'assigned') {
        throw new Error('Can only chat with assigned tickets');
      }

      const token = localStorage.getItem('token');
      const [ticketRes, chatRes] = await Promise.all([
        fetch(`http://localhost:5000/api/tickets/${ticket.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:5000/api/chats/${ticket.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      if (!ticketRes.ok || !chatRes.ok) {
        throw new Error('Failed to load ticket details');
      }

      const ticketData = await ticketRes.json();
      const chatData = await chatRes.json();

      setSelectedTicket({
        ...ticketData,
        userName: `${user.first_name} ${user.last_name}`,
        userEmail: user.email,
        chatHistory: chatData
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatusBadge = (status) => {
    const colorMap = {
      open: 'warning',
      assigned: 'success',
      closed: 'info',
      rejected: 'error',
      inactive: 'default'
    };
    return (
      <Chip
        label={status?.charAt(0)?.toUpperCase() + status?.slice(1)}
        color={colorMap[status] || 'default'}
        size="small"
      />
    );
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <Box sx={{ p: 2, mt: 8 }}>
          <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', mt: '64px' }}>
        {/* Ticket List Sidebar */}
        <Box sx={{ width: '350px', borderRight: '1px solid #e0e0e0', overflowY: 'auto' }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight="bold">My Tickets</Typography>
          </Box>
          
          <List>
            {tickets.map((ticket) => (
              <ListItem
                key={ticket.id}
                button
                selected={selectedTicket?.id === ticket.id}
                onClick={() => handleTicketSelect(ticket)}
                sx={{
                  borderBottom: '1px solid #f0f0f0',
                  '&.Mui-selected': {
                    backgroundColor: '#e3f2fd',
                    '&:hover': {
                      backgroundColor: '#bbdefb'
                    }
                  }
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography fontWeight="medium">#{ticket.id}</Typography>
                      <Typography variant="caption">
                        {formatTime(ticket.last_message_at || ticket.created_at)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography noWrap>{ticket.subject}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        {renderStatusBadge(ticket.status)}
                        {ticket.status === 'assigned' && (
                          <Button
                            size="small"
                            startIcon={<Chat />}
                            sx={{ ml: 1 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTicketSelect(ticket);
                            }}
                          >
                            Chat
                          </Button>
                        )}
                      </Box>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>

        {/* Main Content Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedTicket ? (
            <>
              <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="h6">
                  Ticket #{selectedTicket.id} - {selectedTicket.subject}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  {renderStatusBadge(selectedTicket.status)}
                  <Chip label={`Priority: ${selectedTicket.priority}`} size="small" />
                  <Chip label={`Category: ${selectedTicket.category}`} size="small" />
                </Box>
              </Box>

              <Box sx={{ flex: 1, display: 'flex' }}>
                {/* Ticket Details */}
                <Box sx={{ width: '300px', p: 2, borderRight: '1px solid #e0e0e0', overflowY: 'auto' }}>
                  <Typography variant="subtitle1" gutterBottom>Details</Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" paragraph>
                    <strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Description:</strong>
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1, mb: 2 }}>
                    <Typography variant="body2">{selectedTicket.description}</Typography>
                  </Paper>

                  {selectedTicket.closure_reason && (
                    <>
                      <Typography variant="body2" paragraph>
                        <strong>Closure Reason:</strong>
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 1 }}>
                        <Typography variant="body2">{selectedTicket.closure_reason}</Typography>
                      </Paper>
                    </>
                  )}
                </Box>

                {/* Chat Window */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <ChatWindow
                    ticketId={selectedTicket.id}
                    initialMessages={selectedTicket.chatHistory || []}
                    readOnly={selectedTicket.status !== 'assigned'}
                    sx={{ flex: 1 }}
                  />
                </Box>
              </Box>
            </>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h6" color="textSecondary">
                {tickets.length > 0 
                  ? "Select a ticket to start chatting" 
                  : "You don't have any tickets yet"}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
}

export default UserTicketsPage;