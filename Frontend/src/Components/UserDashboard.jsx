import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Paper,
  Snackbar,
  Modal,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChatIcon from '@mui/icons-material/Chat';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import { getSocket } from './socket';
import ChatWindow from './ChatWindow';

function UserDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [newTicket, setNewTicket] = useState({
    category: '',
    urgency: '',
    description: '',
  });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth');
      return;
    }

    if (user?.role !== 'user') {
      navigate('/member/dashboard');
      return;
    }

    socketRef.current = getSocket();
    socketRef.current.on('ticket_closed', ({ ticket_id, reason, reassigned_to }) => {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticket_id
            ? { ...ticket, status: 'closed', closure_reason: reason, reassigned_to }
            : ticket
        )
      );
      if (selectedTicket?.id === ticket_id) {
        setSelectedTicket((prev) => ({ ...prev, status: 'closed', closure_reason: reason, reassigned_to }));
      }
    });

    socketRef.current.on('ticket_reopened', ({ ticket_id }) => {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticket_id
            ? { ...ticket, status: 'assigned', closure_reason: null, reassigned_to: null }
            : ticket
        )
      );
      if (selectedTicket?.id === ticket_id) {
        setSelectedTicket((prev) => ({ ...prev, status: 'assigned', closure_reason: null, reassigned_to: null }));
      }
    });

    socketRef.current.on('chat_inactive', ({ ticket_id, reason }) => {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticket_id
            ? { ...ticket, status: 'closed', closure_reason: reason }
            : ticket
        )
      );
      if (selectedTicket?.id === ticket_id) {
        setSelectedTicket((prev) => ({ ...prev, status: 'closed', closure_reason: reason }));
      }
    });

    fetchTickets();

    return () => {
      socketRef.current.off('ticket_closed');
      socketRef.current.off('ticket_reopened');
      socketRef.current.off('chat_inactive');
    };
  }, [user?.role, navigate]);

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch tickets');

      const data = await res.json();
      setTickets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: newTicket.category,
          urgency: newTicket.urgency,
          description: newTicket.description,
          user_id: user.id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create ticket');
      }

      const data = await res.json();
      setDialogOpen(false);
      setNewTicket({ category: '', urgency: '', description: '' });
      setNotification({
        type: 'success',
        message: 'Ticket created successfully',
      });

      if (socketRef.current) {
        socketRef.current.emit('ticket_created', {
          ticket_id: data.ticket_id,
          user_id: user.id,
          category: newTicket.category,
          urgency: newTicket.urgency,
          description: newTicket.description,
        });
      }

      fetchTickets();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message,
      });
    }
  };

  const handleChatClick = async (ticket) => {
    try {
      if (ticket.status !== 'assigned') {
        throw new Error('Can only chat with assigned tickets');
      }

      if (!socketRef.current || !socketRef.current.connected) {
        socketRef.current = getSocket();
        if (!socketRef.current) {
          throw new Error('Failed to initialize chat connection');
        }
      }

      socketRef.current.emit('join', { ticket_id: ticket.id });

      socketRef.current.on('joined', (data) => {
        console.log('Joined chat room:', data.room);
      });

      const token = localStorage.getItem('token');
      const chatRes = await fetch(`http://localhost:5000/api/chats/${ticket.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!chatRes.ok) throw new Error('Failed to load chat history');

      const chatHistory = await chatRes.json();

      setSelectedTicket({
        ...ticket,
        userName: `${user.first_name} ${user.last_name}`,
        userEmail: user.email,
        chatHistory,
      });
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message,
      });
    }
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
          <Alert severity="error">{error}</Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Box
        sx={{
          p: 4,
          mt: '64px',
          bgcolor: '#f0f2f5',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Box
          sx={{
            maxWidth: 1200,
            mx: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            fontFamily:'times new roman',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold',fontFamily:'times new roman' }}>
              My Support Tickets
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{
                bgcolor: '#128C7E',
                fontFamily:'times new roman',
                '&:hover': {
                  bgcolor: '#075E54',
                  
                },
              }}
            >
              New Ticket
            </Button>
          </Box>

          <Grid container spacing={4}>
            {tickets.map((ticket) => (
              <Grid item xs={12} sm={6} md={4} key={ticket.id}>
                <Paper
                  elevation={3}
                  sx={{
                    p: 2,
                    width: 250, 
                    height: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    fontFamily:'times new roman',
                    gap: 1,
                    position: 'relative',
                    '&:hover': {
                      boxShadow: 6,
                    },
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' ,fontFamily:'times new roman',}}
                  >
                    Ticket {ticket.id}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' ,fontFamily:'times new roman'}}
                  >
                    Category: {ticket.category}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',fontFamily:'times new roman' }}
                  >
                    Urgency: {ticket.urgency}
                  </Typography>
                  <Typography
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      display: 'inline-block',
                      width: 'fit-content',
                      color: 'white',
                      fontFamily:'times new roman',
                      bgcolor:
                        ticket.status === 'open'
                          ? '#ff9800'
                          : ticket.status === 'assigned'
                          ? '#4caf50'
                          : ticket.status === 'rejected'
                          ? '#f44336'
                          : ticket.status === 'closed'
                          ? '#2196f3'
                          : 'inherit',
                    }}
                  >
                    {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                  </Typography>
                  {ticket.closure_reason && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontFamily:'times new roman'
                      }}
                    >
                      <strong>Closure Reason:</strong> {ticket.closure_reason}
                    </Typography>
                  )}
                  {ticket.reassigned_to && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',fontFamily:'times new roman' }}
                    >
                      <strong>Reassigned To:</strong> Member ID {ticket.reassigned_to}
                    </Typography>
                  )}
                  {ticket.status === 'assigned' && ticket.last_message_at && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',fontFamily:'times new roman' }}
                    >
                      <strong>Status:</strong> Active
                    </Typography>
                  )}
                  {ticket.status === 'assigned' && (
                    <Button
                      startIcon={<ChatIcon />}
                      onClick={() => handleChatClick(ticket)}
                      sx={{
                        mt: 'auto',
                        color: '#128C7E',
                        '&:hover': {
                          bgcolor: 'rgba(18, 140, 126, 0.08)',
                        },
                        whiteSpace: 'nowrap',
                        fontFamily:'times new roman',
                      }}
                    >
                      Chat with Support
                    </Button>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      <Modal
        open={Boolean(selectedTicket)}
        onClose={() => {
          if (socketRef.current) {
            socketRef.current.off('joined');
            socketRef.current.emit('leave', { ticket_id: selectedTicket?.id });
          }
          setSelectedTicket(null);
        }}
        aria-labelledby="chat-modal"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Paper sx={{ width: '90%', height: '90vh', maxWidth: 1200, p: 3, position: 'relative', overflow: 'hidden' }}>
          {selectedTicket && (
            <Grid container spacing={2} sx={{ height: '100%' }}>
              <Grid item xs={4}>
                <Paper elevation={2} sx={{ p: 2, height: '100%', overflow: 'auto' }}>
                  <Typography variant="h6" gutterBottom>
                    Ticket Details
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography><strong>Ticket ID:</strong> #{selectedTicket.id}</Typography>
                    <Typography><strong>Created By:</strong> {selectedTicket.userName}</Typography>
                    <Typography><strong>User Email:</strong> {selectedTicket.userEmail}</Typography>
                    <Typography><strong>Category:</strong> {selectedTicket.category}</Typography>
                    <Typography><strong>Urgency:</strong> {selectedTicket.urgency}</Typography>
                    <Typography><strong>Status:</strong> {selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}</Typography>
                    <Typography><strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}</Typography>
                    <Typography><strong>Description:</strong></Typography>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                      {selectedTicket.description}
                    </Paper>
                    {selectedTicket.status === 'closed' && selectedTicket.closure_reason && (
                      <>
                        <Typography><strong>Closure Reason:</strong></Typography>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                          {selectedTicket.closure_reason}
                        </Paper>
                        {selectedTicket.reassigned_to && (
                          <Typography><strong>Reassigned To:</strong> Member ID {selectedTicket.reassigned_to}</Typography>
                        )}
                      </>
                    )}
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={8}>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">Chat Window</Typography>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        if (socketRef.current) {
                          socketRef.current.off('joined');
                          socketRef.current.emit('leave', { ticket_id: selectedTicket.id });
                        }
                        setSelectedTicket(null);
                      }}
                    >
                      Close Chat
                    </Button>
                  </Box>
                  <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                    <ChatWindow
                      ticketId={selectedTicket.id}
                      initialMessages={selectedTicket.chatHistory || []}
                      inactivityTimeout={120000} // 2 minutes in milliseconds
                    />
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}
        </Paper>
      </Modal>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Support Ticket</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={newTicket.category}
                label="Category"
                onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
              >
                <MenuItem value="Technical">Technical</MenuItem>
                <MenuItem value="Billing">Billing</MenuItem>
                <MenuItem value="General">General</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Urgency</InputLabel>
              <Select
                value={newTicket.urgency}
                label="Urgency"
                onChange={(e) => setNewTicket({ ...newTicket, urgency: e.target.value })}
              >
                <MenuItem value="Low">Low</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="High">High</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Description"
              value={newTicket.description}
              onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateTicket}
            variant="contained"
            disabled={!newTicket.category || !newTicket.urgency || !newTicket.description}
            sx={{
              bgcolor: '#128C7E',
              '&:hover': {
                bgcolor: '#075E54',
              },
            }}
          >
            Create Ticket
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {notification && (
          <Alert
            onClose={() => setNotification(null)}
            severity={notification.type}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </>
  );
}

export default UserDashboard;