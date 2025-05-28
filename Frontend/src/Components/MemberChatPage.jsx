import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Divider, Grid, CircularProgress, Alert
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { getSocket } from './socket';
import useStore from '../store/useStore';
import ChatWindow from './ChatWindow';

function MemberChatPage() {
  const { ticketId } = useParams();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const socketRef = useRef();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) {
      navigate('/auth');
      return;
    }

    fetchTickets();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user]);

  useEffect(() => {
    if (ticketId && tickets.length > 0) {
      const ticket = tickets.find(t => t.id.toString() === ticketId);
      if (ticket) {
        selectTicket(ticket);
      } else {
        setSelectedTicket(null);
        setSelectedTicketDetails(null);
      }
    }
  }, [ticketId, tickets]);

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch tickets');
      const data = await res.json();
      setTickets(data);
      setLoading(false);
    } catch (err) {
      setErrors(prev => [...prev, err.message]);
      setLoading(false);
    }
  };

  const selectTicket = async (ticket) => {
    try {
      setSelectedTicket(ticket);
      const token = localStorage.getItem('token');
      const userRes = await fetch(`http://localhost:5000/api/users/${ticket.user_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!userRes.ok) throw new Error('Failed to fetch user details');
      const userData = await userRes.json();

      const chatRes = await fetch(`http://localhost:5000/api/chats/${ticket.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!chatRes.ok) throw new Error('Failed to fetch chat history');
      const chatHistory = await chatRes.json();

      setSelectedTicketDetails({
        ...ticket,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email,
        chatHistory,
      });

      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      socketRef.current = getSocket();
      socketRef.current.emit('join', { ticket_id: ticket.id });
    } catch (err) {
      setErrors(prev => [...prev, err.message]);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (errors.length) {
    return (
      <Box sx={{ p: 2 }}>
        {errors.map((error, index) => (
          <Alert key={index} severity="error">{error}</Alert>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Box sx={{ width: '30%', borderRight: '1px solid #ccc', overflowY: 'auto' }}>
        <Typography variant="h5" sx={{ p: 2, fontWeight: 'bold', font: 'Open Sans' }}>
          Tickets
        </Typography>
        {tickets.map(ticket => (
          <Paper
            key={ticket.id}
            sx={{
              p: 2,
              m: 1,
              cursor: 'pointer',
              bgcolor: selectedTicket?.id === ticket.id ? '#e0e0e0' : 'white',
              font: 'Open Sans',
            }}
            onClick={() => navigate(`/member/chat/${ticket.id}`)}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              #{ticket.id} - {ticket.subject || 'No Subject'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Status: {ticket.status}
            </Typography>
          </Paper>
        ))}
      </Box>
      <Box sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column' }}>
        {selectedTicket ? (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', font: 'Open Sans' }}>
                Ticket Details
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography><strong>Ticket ID:</strong> #{selectedTicket.id}</Typography>
              <Typography><strong>Created By:</strong> {selectedTicketDetails?.userName}</Typography>
              <Typography><strong>User Email:</strong> {selectedTicketDetails?.userEmail}</Typography>
              <Typography><strong>Category:</strong> {selectedTicket.category}</Typography>
              <Typography><strong>priority:</strong> {selectedTicket.priority}</Typography>
              <Typography><strong>Status:</strong> {selectedTicket.status}</Typography>
              <Typography><strong>Created:</strong> {selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : 'N/A'}</Typography>
              <Typography><strong>Description:</strong></Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                {selectedTicket.description}
              </Paper>
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <ChatWindow
                ticketId={selectedTicket.id}
                initialMessages={selectedTicketDetails?.chatHistory || []}
                inactivityTimeout={120000}
                onSendMessage={(message) => {
                  if (selectedTicket.status === 'closed') {
                    setErrors(prev => [...prev, 'Cannot send messages to a closed ticket']);
                    return;
                  }
                  socketRef.current.emit('message', {
                    ticket_id: selectedTicket.id,
                    sender_id: user.id,
                    message,
                  });
                }}
              />
            </Box>
          </>
        ) : (
          <Typography variant="h6" sx={{ textAlign: 'center', mt: 4 }}>
            Select a ticket to view details and chat
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default MemberChatPage;
