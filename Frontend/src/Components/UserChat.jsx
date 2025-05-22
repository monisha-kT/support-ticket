import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Alert, 
  Button,
  Paper
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import ChatWindow from './ChatWindow';
import Navbar from './Navbar';
import useStore from '../store/useStore';
import { getSocket } from './socket';

function UserChat() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef(null);

  // Extract selectedTicketId from query params
  const queryParams = new URLSearchParams(location.search);
  const selectedTicketId = queryParams.get('selectedTicketId');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth');
      return;
    }

    if (user?.role !== 'user') {
      navigate(user?.role === 'member' ? '/member/dashboard' : '/admin/dashboard');
      return;
    }

    if (!selectedTicketId) {
      setError('No ticket selected');
      setLoading(false);
      return;
    }

    const socket = getSocket();
    socketRef.current = socket;

    socket.on('connect_success', () => {
      socket.emit('join', { ticket_id: selectedTicketId });
    });

    socket.on('message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('ticket_closed', ({ ticket_id, reason, reassigned_to }) => {
      if (ticket_id === selectedTicketId) {
        setTicket((prev) => ({ ...prev, status: 'closed', closure_reason: reason, reassigned_to }));
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            message: `Ticket closed. Reason: ${reason}${reassigned_to ? `. Reassigned to member ID ${reassigned_to}` : ''}`,
            timestamp: new Date().toISOString(),
            is_system: true,
          },
        ]);
      }
    });

    socket.on('ticket_reopened', ({ ticket_id }) => {
      if (ticket_id === selectedTicketId) {
        setTicket((prev) => ({ ...prev, status: 'assigned', closure_reason: null, reassigned_to: null }));
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            message: 'Ticket has been reopened.',
            timestamp: new Date().toISOString(),
            is_system: true,
          },
        ]);
      }
    });

    socket.on('chat_inactive', ({ ticket_id, reason }) => {
      if (ticket_id === selectedTicketId) {
        setTicket((prev) => ({ ...prev, status: 'closed', closure_reason: reason }));
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            message: reason,
            timestamp: new Date().toISOString(),
            is_system: true,
          },
        ]);
      }
    });

    return () => {
      socket.emit('leave', { ticket_id: selectedTicketId });
      socket.off('connect_success');
      socket.off('message');
      socket.off('ticket_closed');
      socket.off('ticket_reopened');
      socket.off('chat_inactive');
    };
  }, [user?.role, navigate, selectedTicketId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedTicketId || selectedTicketId === 'null') {
        setError('Invalid ticket ID');
        setLoading(false);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found');
          navigate('/auth');
          return;
        }
        const [ticketRes, chatRes] = await Promise.all([
          fetch(`http://localhost:5000/api/tickets/${selectedTicketId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
          fetch(`http://localhost:5000/api/chats/${selectedTicketId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
        ]);
        if (!ticketRes.ok) throw new Error('Failed to fetch ticket');
        if (!chatRes.ok) {
          const errorData = await chatRes.json();
          throw new Error(`Failed to fetch messages: ${errorData.message || chatRes.statusText}`);
        }
        const ticketData = await ticketRes.json();
        const chatData = await chatRes.json();
        setTicket(ticketData);
        setMessages(chatData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedTicketId, navigate]);

  const handleSendMessage = (message) => {
    if (ticket?.status === 'closed') {
      setError('Cannot send messages to a closed ticket');
      return;
    }

    const socket = socketRef.current;
    if (socket) {
      socket.emit('message', {
        ticket_id: selectedTicketId,
        sender_id: user.id,
        message,
      });
    }
  };

  const handleReopenTicket = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${selectedTicketId}/reopen`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to reopen ticket');
      setTicket((prev) => ({ ...prev, status: 'assigned', closure_reason: null, reassigned_to: null }));
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          message: 'Ticket has been reopened.',
          timestamp: new Date().toISOString(),
          is_system: true,
        },
      ]);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'centerлинг', alignItems: 'center', height: '100vh' }}>
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
      <Box sx={{ p: 4, mt: '64px', bgcolor: '#f0f2f5', minHeight: 'calc(100vh - 64px)' }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
            Chat for Ticket #{selectedTicketId}
          </Typography>
          {ticket && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography><strong>Status:</strong> {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}</Typography>
              <Typography><strong>Category:</strong> {ticket.category}</Typography>
              <Typography><strong>Urgency:</strong> {ticket.urgency}</Typography>
              {ticket.closure_reason && (
                <Typography><strong>Closure Reason:</strong> {ticket.closure_reason}</Typography>
              )}
              {ticket.reassigned_to && (
                <Typography><strong>Reassigned To:</strong> Member ID {ticket.reassigned_to}</Typography>
              )}
              {ticket.status === 'closed' && (
                <Button
                  variant="contained"
                  onClick={handleReopenTicket}
                  sx={{ mt: 2, bgcolor: '#128C7E', '&:hover': { bgcolor: '#075E54' } }}
                >
                  Reopen Ticket
                </Button>
              )}
            </Paper>
          )}
          <ChatWindow
            ticketId={selectedTicketId}
            initialMessages={messages}
            onSendMessage={handleSendMessage}
            readOnly={ticket?.status === 'closed'}
          />
        </Box>
      </Box>
    </>
  );
}

export default UserChat;