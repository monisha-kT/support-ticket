import React, { useState, useEffect } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Button, Paper, Modal, Grid, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getSocket, useSocket } from './socket';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import ChatWindow from './ChatWindow';

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reassignTicketId, setReassignTicketId] = useState(null);
  const [closeTicketId, setCloseTicketId] = useState(null);
  const [reassignTo, setReassignTo] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchFilters, setSearchFilters] = useState({
    id: '',
    subject: '',
    description: '',
    created_at: '',
    status: '',
    activeStatus: '',
    userName: '',
    memberName: '',
    closure_reason: ''
  });
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const { isConnected, error: socketError } = useSocket();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth');
      return;
    }
    if (!user) return;
    if (user.role !== 'admin') {
      navigate(user.role === 'user' ? '/dashboard' : '/member/tickets');
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    let socket = null;
    const setupSocket = async () => {
      socket = await getSocket();
      if (!socket) {
        setError('Failed to establish socket connection');
        return;
      }

      socket.on('new_ticket', fetchTickets);
      socket.on('ticket_closed', ({ ticket_id, reason, reassigned_to }) => {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? { ...ticket, status: reassigned_to ? 'reassigned' : 'closed', closure_reason: reason, reassigned_to }
              : ticket
          )
        );
      });
      socket.on('ticket_reopened', ({ ticket_id }) => {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? { ...ticket, status: 'assigned', closure_reason: null, reassigned_to: null }
              : ticket
          )
        );
      });
      socket.on('chat_inactive', ({ ticket_id, reason }) => {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? { ...ticket, status: 'closed', closure_reason: reason }
              : ticket
          )
        );
      });
      socket.on('ticket_reassigned', ({ ticket_id, assigned_to, status }) => {
        const member = members.find(m => m.id === assigned_to);
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? {
                  ...ticket,
                  assigned_to,
                  status,
                  memberName: member ? `${member.first_name} ${member.last_name}` : 'Unassigned'
                }
              : ticket
          )
        );
      });
      socket.on('ticket_inactive', ({ ticket_id, status, reason }) => {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? { ...ticket, status, closure_reason: reason }
              : ticket
          )
        );
      });
    };

    setupSocket();
    fetchTickets();
    fetchMembers();

    return () => {
      if (socket) {
        socket.off('new_ticket');
        socket.off('ticket_closed');
        socket.off('ticket_reopened');
        socket.off('chat_inactive');
        socket.off('ticket_reassigned');
        socket.off('ticket_inactive');
      }
    };
  }, [user, navigate]);

  useEffect(() => {
    if (socketError) {
      setError(socketError);
    }
  }, [socketError]);

  const fetchMembers = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/users/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchTickets = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch tickets');
      const data = await res.json();
      const userIds = [
        ...new Set(
          data
            .map((ticket) => ticket.user_id)
            .concat(data.map((ticket) => ticket.assigned_to).filter((id) => id))
        ),
      ];
      const usersRes = await fetch('http://localhost:5000/api/users/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: userIds }),
      });
      if (!usersRes.ok) throw new Error('Failed to fetch user details');
      const usersData = await usersRes.json();
      const ticketsWithDetails = data.map((ticket) => ({
        ...ticket,
        userName: usersData[ticket.user_id]
          ? `${usersData[ticket.user_id].first_name} ${usersData[ticket.user_id].last_name}`
          : 'Unknown',
        memberName: ticket.assigned_to && usersData[ticket.assigned_to]
          ? `${usersData[ticket.assigned_to].first_name} ${usersData[ticket.assigned_to].last_name}`
          : 'Unassigned',
        activeStatus:
          ticket.status === 'assigned' && ticket.last_message_at
            ? new Date(ticket.last_message_at) > new Date(Date.now() - 2 * 60 * 1000)
              ? 'Active'
              : 'Inactive'
            : 'N/A',
      }));
      
      // Sort tickets by created_at in descending order (newest first)
      const sortedTickets = ticketsWithDetails.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      setTickets(sortedTickets);
      setFilteredTickets(sortedTickets);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (ticket) => {
    try {
      setError(null);
      setDetailsLoading(true);
      const token = localStorage.getItem('token');
      const ticketId = ticket.id;
      
      const [ticketRes, chatRes, userRes] = await Promise.all([
        fetch(`http://localhost:5000/api/tickets/${ticket.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:5000/api/chats/${ticket.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:5000/api/users/${ticket.user_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      if (!ticketRes.ok || !chatRes.ok || !userRes.ok) {
        throw new Error('Failed to fetch ticket details');
      }

      const ticketData = await ticketRes.json();
      const chatData = await chatRes.json();
      const userData = await userRes.json();

      if (ticket.id !== ticketId) return;

      setSelectedTicketDetails({
        ...ticketData,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email,
      });
      
      setSelectedTicket({
        ...ticketData,
        chats: chatData,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email
      });
    } catch (err) {
      setError('Failed to fetch ticket details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleReassignTicket = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${reassignTicketId}/reassign`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          reassign_to: parseInt(reassignTo),
          reason: 'Reassigned by admin'
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      
      setReassignDialogOpen(false);
      setReassignTo('');
      setReassignTicketId(null);
      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCloseTicket = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${closeTicketId}/close`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: closeReason || 'Closed by admin' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const socket = await getSocket();
      if (socket) {
        socket.emit('ticket_closed', { ticket_id: closeTicketId, reason: closeReason || 'Closed by admin' });
      }
      setCloseDialogOpen(false);
      setCloseReason('');
      setCloseTicketId(null);
      setSelectedTicket(null);
      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSearchChange = (field, value) => {
    setSearchFilters((prev) => ({ ...prev, [field]: value }));
    const filtered = tickets.filter((ticket) =>
      Object.keys(searchFilters).every((key) => {
        if (key === field && value) {
          return String(ticket[key] || '')
            .toLowerCase()
            .includes(value.toLowerCase());
        }
        if (searchFilters[key]) {
          return String(ticket[key] || '')
            .toLowerCase()
            .includes(searchFilters[key].toLowerCase());
        }
        return true;
      })
    );
    setFilteredTickets(filtered);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const columns = [
    { field: 'id', headerName: 'Ticket ID', minWidth: 100 },
    { field: 'subject', headerName: 'Subject', minWidth: 150 },
    { field: 'description', headerName: 'Description', minWidth: 200 },
    { field: 'created_at', headerName: 'Created Date', minWidth: 120 },
    { field: 'created_at_time', headerName: 'Created Time', minWidth: 100 },
    { field: 'status', headerName: 'Status', minWidth: 100 },
    { field: 'activeStatus', headerName: 'Active Status', minWidth: 120 },
    { field: 'userName', headerName: 'Created By', minWidth: 150 },
    { field: 'memberName', headerName: 'Assigned To', minWidth: 150 },
    { field: 'closure_reason', headerName: 'Closure Reason', minWidth: 150 },
    { field: 'actions', headerName: 'Action', minWidth: 200 }
  ];

  return (
    <>
      <Navbar />
      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, marginBottom: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 8, font: 'Open Sans', fontSize: '26px' }}>
            Admin Dashboard
          </Typography>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, flexGrow: 1 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2, flexGrow: 1 }}>
            {error}
          </Alert>
        ) : (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', px: 2, pb: 2 }}>
            <TableContainer component={Paper} sx={{ flexGrow: 1, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    {columns.map((column) => (
                      <TableCell 
                        key={column.field} 
                        sx={{ 
                          fontWeight: 'bold', 
                          bgcolor: '#128C7E', 
                          color: 'white',
                          minWidth: column.minWidth,
                          font: 'Open Sans',
                          fontSize: '16px'
                        }}
                      >
                        {column.headerName}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableHead>
                  <TableRow>
                    {columns.map((column) => (
                      <TableCell key={`search-${column.field}`} sx={{ bgcolor: '#e0f2f1', p: 1 }}>
                        {column.field !== 'actions' && (
                          <TextField
                            size="small"
                            fullWidth
                            variant="outlined"
                            placeholder={`Search ${column.headerName}`}
                            value={searchFilters[column.field] || ''}
                            onChange={(e) => handleSearchChange(column.field, e.target.value)}
                            sx={{
                              '& .MuiInputBase-root': {
                                height: 40,
                                font: 'Open Sans',
                              },
                            }}
                          />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTickets
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((ticket) => (
                      <TableRow key={ticket.id} hover>
                        <TableCell sx={{ font: 'Open Sans', fontSize: '16px' }}>{ticket.id}</TableCell>
                        <TableCell sx={{ font: 'Open Sans', fontSize: '16px' }}>{ticket.subject}</TableCell>
                        <TableCell sx={{ 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          maxWidth: 200,
                          font: 'Open Sans',
                          fontSize: '16px'
                        }}>
                          {ticket.description}
                        </TableCell>
                        <TableCell sx={{ font: 'Open Sans', fontSize: '16px' }}>
                          {formatDate(ticket.created_at)}
                        </TableCell>
                        <TableCell sx={{ font: 'Open Sans', fontSize: '16px' }}>
                          {formatDateTime(ticket.created_at)}
                        </TableCell>
                        <TableCell sx={{ font: 'Open Sans', fontSize: '16px' }}>
                          <Typography
                            sx={{
                              bgcolor:
                                ticket.status === 'open' ? 'warning.main' :
                                ticket.status === 'assigned' ? 'info.main' :
                                ticket.status === 'inactive' ? 'error.main' :
                                ticket.status === 'reassigned' ? 'secondary.main' :
                                ticket.status === 'closed' ? 'success.main' :
                                ticket.status === 'rejected' ? 'error.main' : 'inherit',
                              color: 'white',
                              width: 120,
                              height: 32,
                              lineHeight: '32px',
                              textAlign: 'center',
                              borderRadius: 1,
                              display: 'inline-block',
                              fontFamily: 'Open Sans',
                              fontSize: '16px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ font: 'Open Sans', fontSize: '16px' }}>
                          {ticket.activeStatus}
                        </TableCell>
                        <TableCell sx={{ font: 'Open Sans', fontSize: '16px' }}>
                          {ticket.userName}
                        </TableCell>
                        <TableCell sx={{ font: 'Open Sans', fontSize: '16px' }}>
                          {ticket.memberName}
                        </TableCell>
                        <TableCell sx={{ font: 'Open Sans', fontSize: '16px' }}>
                          {ticket.closure_reason || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleViewDetails(ticket)}
                              sx={{ 
                                textTransform: 'capitalize',
                                font: 'Open Sans',
                                fontSize: '14px'
                              }}
                            >
                              View
                            </Button>
                            {ticket.status !== 'closed' && ticket.status !== 'rejected' && (
                              <>
                                <Button
                                  variant="contained"
                                  size="small"
                                  color="secondary"
                                  onClick={() => {
                                    setReassignTicketId(ticket.id);
                                    setReassignDialogOpen(true);
                                  }}
                                  sx={{ 
                                    textTransform: 'capitalize',
                                    font: 'Open Sans',
                                    fontSize: '14px'
                                  }}
                                >
                                  Reassign
                                </Button>
                                <Button
                                  variant="contained"
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setCloseTicketId(ticket.id);
                                    setCloseDialogOpen(true);
                                  }}
                                  sx={{ 
                                    textTransform: 'capitalize',
                                    font: 'Open Sans',
                                    fontSize: '14px'
                                  }}
                                >
                                  Close

                                </Button>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredTickets.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ font: 'Open Sans' }}
            />
          </Box>
        )}

        {/* Ticket Details Modal */}
        <Modal
          open={Boolean(selectedTicket)}
          onClose={(event, reason) => {
   
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      return; 
    }
    setSelectedTicket(null);
  }}
          aria-labelledby="ticket-details-modal"
          aria-describedby="ticket-details-description"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)'
          }}
        >
          <Box sx={{
            width: '90%',
            maxWidth: '1200px',
            height: '90vh',
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {detailsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : selectedTicket && (
              <>
                <Box sx={{
                  p: 2,
                  bgcolor: '#128C7E',
                  color: 'white',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Typography variant="h6" sx={{ font: 'Open Sans', fontWeight: 'bold' }}>
                    Ticket #{selectedTicket.id} - {selectedTicket.subject}
                  </Typography>
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    onClick={() => setSelectedTicket(null)}
                    sx={{ font: 'Open Sans' }}
                  >
                    <CloseIcon />
                  </Button>
                </Box>
                
                <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex' }}>
                  {/* Left Panel - Ticket Details */}
                  <Box sx={{
                    width: '30%',
                    p: 2,
                    overflowY: 'auto',
                    borderRight: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="h6" sx={{ mb: 2, font: 'Open Sans', fontWeight: 'bold' }}>
                      Ticket Information
                    </Typography>
                    
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" sx={{ font: 'Open Sans', fontWeight: 'bold', color: 'text.secondary' }}>
                        BASIC INFORMATION
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box>
                          <Typography variant="body2" sx={{ font: 'Open Sans', color: 'text.secondary' }}>
                            Created By
                          </Typography>
                          <Typography variant="body1" sx={{ font: 'Open Sans' }}>
                            {selectedTicketDetails?.userName || 'Loading...'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ font: 'Open Sans', color: 'text.secondary' }}>
                            User Email
                          </Typography>
                          <Typography variant="body1" sx={{ font: 'Open Sans' }}>
                            {selectedTicketDetails?.userEmail || 'Loading...'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ font: 'Open Sans', color: 'text.secondary' }}>
                            Created On
                          </Typography>
                          <Typography variant="body1" sx={{ font: 'Open Sans' }}>
                            {formatDate(selectedTicket.created_at)} at {formatDateTime(selectedTicket.created_at)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" sx={{ font: 'Open Sans', fontWeight: 'bold', color: 'text.secondary' }}>
                        TICKET DETAILS
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box>
                          <Typography variant="body2" sx={{ font: 'Open Sans', color: 'text.secondary' }}>
                            Category
                          </Typography>
                          <Typography variant="body1" sx={{ font: 'Open Sans' }}>
                            {selectedTicket.category}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ font: 'Open Sans', color: 'text.secondary' }}>
                            Priority
                          </Typography>
                          <Typography variant="body1" sx={{ font: 'Open Sans' }}>
                            {selectedTicket.priority}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ font: 'Open Sans', color: 'text.secondary' }}>
                            Status
                          </Typography>
                          <Typography variant="body1" sx={{ font: 'Open Sans' }}>
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-block',
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                bgcolor:
                                  selectedTicket.status === 'open' ? 'warning.main' :
                                  selectedTicket.status === 'assigned' ? 'info.main' :
                                  selectedTicket.status === 'inactive' ? 'error.main' :
                                  selectedTicket.status === 'reassigned' ? 'secondary.main' :
                                  selectedTicket.status === 'closed' ? 'success.main' :
                                  selectedTicket.status === 'rejected' ? 'error.main' : 'inherit',
                                color: 'white',
                                font: 'Open Sans',
                                fontSize: '14px'
                              }}
                            >
                              {selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}
                            </Box>
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ font: 'Open Sans', color: 'text.secondary' }}>
                            Active Status
                          </Typography>
                          <Typography variant="body1" sx={{ font: 'Open Sans' }}>
                            {selectedTicket.activeStatus}
                          </Typography>
                        </Box>
                        {selectedTicket.assigned_to && (
                          <Box>
                            <Typography variant="body2" sx={{ font: 'Open Sans', color: 'text.secondary' }}>
                              Assigned To
                            </Typography>
                            <Typography variant="body1" sx={{ font: 'Open Sans' }}>
                              {selectedTicket.memberName} 
                            </Typography>
                          </Box>
                        )}
                        {selectedTicket.closure_reason && (
                          <Box>
                            <Typography variant="body2" sx={{ font: 'Open Sans', color: 'text.secondary' }}>
                              Closure Reason
                            </Typography>
                            <Typography variant="body1" sx={{ font: 'Open Sans' }}>
                              {selectedTicket.closure_reason}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                    
                    <Box>
                      <Typography variant="subtitle2" sx={{ font: 'Open Sans', fontWeight: 'bold', color: 'text.secondary' }}>
                        DESCRIPTION
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                        <Typography variant="body1" sx={{ font: 'Open Sans' }}>
                          {selectedTicket.description}
                        </Typography>
                      </Paper>
                    </Box>
                  </Box>
                  
                  {/* Right Panel - Chat Window */}
                  <Box sx={{
                    width: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                  }}>
                    <Box sx={{
                      p: 2,
                      borderBottom: '1px solid #e0e0e0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Typography variant="h6" sx={{ font: 'Open Sans', fontWeight: 'bold' }}>
                        Chat History
                      </Typography>
                      {selectedTicket.status !== 'closed' && selectedTicket.status !== 'rejected' && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            size="small"
                            color="secondary"
                            onClick={() => {
                              setReassignTicketId(selectedTicket.id);
                              setReassignDialogOpen(true);
                            }}
                            sx={{ 
                              textTransform: 'capitalize',
                              font: 'Open Sans',
                              fontSize: '14px'
                            }}
                          >
                            Reassign
                          </Button>
                          <Button
                            variant="contained"
                            size="small"
                            color="error"
                            onClick={() => {
                              setCloseTicketId(selectedTicket.id);
                              setCloseDialogOpen(true);
                            }}
                            sx={{ 
                              textTransform: 'capitalize',
                              font: 'Open Sans',
                              fontSize: '14px'
                            }}
                          >
                            Close Ticket
                          </Button>
                        </Box>
                      )}
                    </Box>
                    
                    <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                      <ChatWindow
                        ticketId={selectedTicket.id}
                        readOnly={selectedTicket.status === 'closed' || selectedTicket.status === 'rejected'}
                        initialMessages={selectedTicket.chats}
                        height="100%"
                      />
                    </Box>
                  </Box>
                </Box>
              </>
            )}
          </Box>
        </Modal>

        {/* Reassign Dialog */}
        <Dialog 
          open={reassignDialogOpen} 
          onClose={() => setReassignDialogOpen(false)} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle sx={{ font: 'Open Sans' }}>Reassign Ticket</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ font: 'Open Sans' }}>Reassign To</InputLabel>
                <Select
                  value={reassignTo}
                  label="Reassign To"
                  onChange={(e) => setReassignTo(e.target.value)}
                  sx={{ font: 'Open Sans' }}
                >
                  <MenuItem value="" sx={{ font: 'Open Sans' }}>Select Member</MenuItem>
                  {members.map(member => (
                    <MenuItem 
                      key={member.id} 
                      value={member.id}
                      sx={{ font: 'Open Sans' }}
                    >
                      {member.first_name} {member.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setReassignDialogOpen(false)}
              sx={{ font: 'Open Sans' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleReassignTicket}
              disabled={!reassignTo}
              sx={{ font: 'Open Sans' }}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        {/* Close Ticket Dialog */}
        <Dialog 
          open={closeDialogOpen} 
          onClose={() => setCloseDialogOpen(false)} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle sx={{ font: 'Open Sans' }}>Close Ticket</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Reason for Closing"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder="Enter reason for closing the ticket"
                sx={{ font: 'Open Sans' }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setCloseDialogOpen(false)}
              sx={{ font: 'Open Sans' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCloseTicket}
              disabled={!closeReason.trim()}
              sx={{ font: 'Open Sans' }}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
}

export default AdminDashboard;