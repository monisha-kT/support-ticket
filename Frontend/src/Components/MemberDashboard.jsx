import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Button, Container, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, TableSortLabel,
  InputAdornment, IconButton, Badge
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { getSocket } from './socket';
import { useNavigate, useParams } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from '../Components/Navbar';
import ChatWindow from './ChatWindow';
import NotificationDrawer from './NotificationDrawer';
import ErrorBoundary from './ErrorBoundary';

function MemberDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [members, setMembers] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('id');
  const [searchValues, setSearchValues] = useState({
    id: '',
    userName: '',
    category: '',
    priority: '',
    status: '',
    lastResponseTime: ''
  });
  const [notifications, setNotifications] = useState([]);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);

  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const { ticketId } = useParams();
  const socketRef = useRef(null);

  const fetchTickets = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tickets');

      const data = await res.json();
      const userIds = [...new Set(data.map(ticket => ticket.user_id))];

      const usersRes = await fetch('http://localhost:5000/api/users/bulk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: userIds }),
      });

      if (!usersRes.ok) throw new Error('Failed to fetch user details');
      const usersData = await usersRes.json();

      const ticketsWithDetails = data.map(ticket => ({
        ...ticket,
        userName: usersData[ticket.user_id]
          ? `${usersData[ticket.user_id].first_name} ${usersData[ticket.user_id].last_name}`
          : 'Unknown',
        userEmail: usersData[ticket.user_id]?.email || 'N/A',
        lastResponseTime: ticket.last_message_at
          ? new Date(ticket.last_message_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : 'No response yet'
      }));

      setTickets(ticketsWithDetails);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/users/members', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      setMembers(await res.json());
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const token = localStorage.getItem('token');
      if (!token || !user) {
        navigate('/auth');
        return;
      }

      const socket = await getSocket();
      if (!socket) {
        setError('Failed to initialize real-time connection');
        setLoading(false);
        return;
      }

      socketRef.current = socket;

      socket.on('new_ticket', () => {
        fetchTickets();
      });

      socket.on('ticket_reassigned', ({ ticket_id, assigned_to }) => {
        fetchTickets();
        if (user.id === assigned_to) {
          setNotifications(prev => [
            ...prev,
            { type: 'info', message: `Ticket #${ticket_id} has been reassigned to you.` }
          ]);
        }
      });

      socket.on('ticket_reopened', () => {
        fetchTickets();
      });

      socket.on('ticket_closed', () => {
        fetchTickets();
      });

      socket.on('chat_inactive', ({ ticket_id, reason, reassigned_to }) => {
        setTickets(prev => prev.map(t =>
          t.id === ticket_id ? { ...t, status: 'closed', closure_reason: reason, reassigned_to } : t
        ));
        if (selectedTicket?.id === ticket_id) {
          setSelectedTicket(null);
          navigate('/member/tickets');
        }
      });

      await Promise.all([fetchTickets(), fetchMembers()]);
    };

    initialize();

    return () => {
      if (socketRef.current) {
        socketRef.current.off('new_ticket');
        socketRef.current.off('ticket_reassigned');
        socketRef.current.off('ticket_reopened');
        socketRef.current.off('ticket_closed');
        socketRef.current.off('chat_inactive');
        socketRef.current.disconnect();
      }
    };
  }, [user, navigate]);

  useEffect(() => {
    if (ticketId && tickets.length > 0) {
      const ticket = tickets.find(t => t.id === parseInt(ticketId));
      if (ticket) {
        handleTicketSelect(ticket.id);
      }
    }
  }, [ticketId, tickets]);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchValues]);

  const filterTickets = () => {
    let filtered = tickets.filter(ticket => {
      return Object.keys(searchValues).every(key => {
        if (!searchValues[key]) return true;
        return String(ticket[key] || '').toLowerCase().includes(searchValues[key].toLowerCase());
      });
    });
    setFilteredTickets(filtered);
  };

  const handleTicketSelect = async (ticketId) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const [ticketRes, chatRes] = await Promise.all([
        fetch(`http://localhost:5000/api/tickets/${ticketId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`http://localhost:5000/api/chats/${ticketId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
      ]);

      if (!ticketRes.ok || !chatRes.ok) {
        throw new Error('Failed to fetch ticket details');
      }

      const ticketData = await ticketRes.json();
      const chatData = await chatRes.json();

      const userRes = await fetch(`http://localhost:5000/api/users/${ticketData.user_id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!userRes.ok) throw new Error('Failed to fetch user details');
      const userData = await userRes.json();

      setSelectedTicket({
        ...ticketData,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email,
        chatHistory: chatData
      });

      navigate(`/member/tickets/${ticketId}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCloseTicket = async () => {
    if (!closeReason.trim()) {
      setError('Closure reason is required');
      return;
    }

    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${selectedTicket.id}/close`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: closeReason,
          reassign_to: reassignTo ? parseInt(reassignTo) : null,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const socket = socketRef.current;
      if (socket) {
        socket.emit('ticket_closed', {
          ticket_id: selectedTicket.id,
          reason: closeReason,
          reassigned_to: reassignTo ? parseInt(reassignTo) : null
        });
      }

      setCloseDialogOpen(false);
      setCloseReason('');
      setReassignTo('');
      setSelectedTicket(null);
      navigate('/member/tickets');
      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAcceptTicket = async (ticketId) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to accept ticket');

      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectTicket = async (ticketId) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to reject ticket');

      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReopenTicket = async (ticketId) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reopen`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to reopen ticket');

      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSearchChange = (prop) => (event) => {
    setSearchValues({ ...searchValues, [prop]: event.target.value });
  };

  const stableSort = (array, comparator) => {
    const stabilizedThis = array.map((el, index) => [el, index]);
    stabilizedThis.sort((a, b) => {
      const order = comparator(a[0], b[0]);
      if (order !== 0) return order;
      return a[1] - b[1];
    });
    return stabilizedThis.map((el) => el[0]);
  };

  const getComparator = (order, orderBy) => {
    return order === 'desc'
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  };

  const descendingComparator = (a, b, orderBy) => {
    if (b[orderBy] < a[orderBy]) {
      return -1;
    }
    if (b[orderBy] > a[orderBy]) {
      return 1;
    }
    return 0;
  };

  const renderStatusBadge = (status) => (
    <Typography
      sx={{
        bgcolor:
          status === 'open' ? 'warning.main' :
          status === 'assigned' ? 'info.main' :
          status === 'closed' ? 'success.main' :
          status === 'rejected' ? 'error.main' : 'primary.main',
        color: 'white',
        px: 2,
        py: 1,
        borderRadius: 1,
        display: 'inline-block'
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Typography>
  );

  const renderActionButtons = (ticket) => (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {ticket.status === 'open' && (
        <>
          <Button
            variant="contained"
            size="small"
            color="success"
            onClick={() => handleAcceptTicket(ticket.id)}
          >
            Accept
          </Button>
          <Button
            variant="contained"
            size="small"
            color="error"
            onClick={() => handleRejectTicket(ticket.id)}
          >
            Reject
          </Button>
        </>
      )}
      {ticket.status === 'assigned' && (
        <>
          <Button
            variant="contained"
            size="small"
            onClick={() => handleTicketSelect(ticket.id)}
          >
            View
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={() => {
              setSelectedTicket(ticket);
              setCloseDialogOpen(true);
            }}
          >
            Close
          </Button>
        </>
      )}
      {ticket.status === 'closed' && (
        <Button
          variant="contained"
          size="small"
          color="primary"
          onClick={() => handleReopenTicket(ticket.id)}
        >
          Reopen
        </Button>
      )}
    </Box>
  );

  const headers = [
    { label: 'Ticket ID', id: 'id' },
    { label: 'Created By', id: 'userName' },
    { label: 'Category', id: 'category' },
    { label: 'Priority', id: 'priority' },
    { label: 'Status', id: 'status' },
    { label: 'Last Response', id: 'lastResponseTime' },
    { label: 'Actions', id: 'actions' },
  ];

  if (loading) {
    return (
      <ErrorBoundary>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </ErrorBoundary>
    );
  }

  if (error) {
    return (
      <ErrorBoundary>
        <Navbar />
        <Box sx={{ p: 2, mt: 8 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: 10, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
            Member Support Dashboard
          </Typography>
       
        </Box>
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 230px)' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableCell key={header.id}>
                      {header.id !== 'actions' ? (
                        <>
                          <TableSortLabel
                            active={orderBy === header.id}
                            direction={orderBy === header.id ? order : 'asc'}
                            onClick={() => handleRequestSort(header.id)}
                          >
                            {header.label}
                          </TableSortLabel>
                          <TextField
                            size="small"
                            value={searchValues[header.id] || ''}
                            onChange={handleSearchChange(header.id)}
                            placeholder={`Search ${header.label}`}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon fontSize="small" />
                                </InputAdornment>
                              )
                            }}
                            sx={{ mt: 1, width: '100%', fontSize: '0.875rem' }}
                          />
                        </>) : (
                        header.label
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {stableSort(filteredTickets, getComparator(order, orderBy))
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((ticket) => (
                    <TableRow key={ticket.id} hover>
                      <TableCell>#{ticket.id}</TableCell>
                      <TableCell>{ticket.userName}</TableCell>
                      <TableCell>{ticket.category}</TableCell>
                      <TableCell>{ticket.priority}</TableCell>
                      <TableCell>{renderStatusBadge(ticket.status)}</TableCell>
                      <TableCell>{ticket.lastResponseTime}</TableCell>
                      <TableCell>{renderActionButtons(ticket)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 15]}
            component="div"
            count={filteredTickets.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
        {selectedTicket && (
          <Dialog
            open={Boolean(selectedTicket)}
            onClose={() => {
              setSelectedTicket(null);
              navigate('/member/tickets');
            }}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle>Ticket #{selectedTicket.id}</DialogTitle>
            <DialogContent>
              <ChatWindow
                ticketId={selectedTicket.id}
                initialMessages={selectedTicket.chatHistory}
                readOnly={selectedTicket.status === 'closed'}
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setSelectedTicket(null);
                  navigate('/member/tickets');
                }}
              >
                Close
              </Button>
            </DialogActions>
          </Dialog>
        )}
        <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Close Ticket</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Reason for Closing"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                required
              />
              <FormControl fullWidth>
                <InputLabel>Reassign To (Optional)</InputLabel>
                <Select
                  value={reassignTo}
                  label="Reassign To (Optional)"
                  onChange={(e) => setReassignTo(e.target.value)}
                >
                  <MenuItem value="">None</MenuItem>
                  {members.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCloseTicket}
              disabled={!closeReason.trim()}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
        <NotificationDrawer
          open={notificationDrawerOpen}
          onClose={() => setNotificationDrawerOpen(false)}
          notifications={notifications}
        />
      </Container>
    </ErrorBoundary>
  );
}

export default MemberDashboard;