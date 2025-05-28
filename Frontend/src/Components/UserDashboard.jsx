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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Snackbar,
  Modal,
  Divider,
  IconButton,
  Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import { getSocket } from './socket';
import ChatWindow from './ChatWindow';

function UserDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: '',
    priority: '',
    description: '',
  });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchFilters, setSearchFilters] = useState({
    id: '',
    subject: '',
    category: '',
    priority: '',
    status: '',
  });
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
      navigate('/dashboard');
      return;
    }

    const initializeSocket = async () => {
      try {
        const socket = await getSocket();
        if (!socket) {
          setError('Failed to initialize socket connection');
          return;
        }
        socketRef.current = socket;

        socket.on('ticket_closed', ({ ticket_id, reason, reassigned_to }) => {
          setTickets((prev) =>
            prev
              .map((ticket) =>
                ticket.id === ticket_id
                  ? { ...ticket, status: 'closed', closure_reason: reason, reassigned_to }
                  : ticket
              )
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          );
          if (selectedTicket?.id === ticket_id) {
            setSelectedTicket((prev) => ({ ...prev, status: 'closed', closure_reason: reason, reassigned_to }));
          }
        });

        socket.on('ticket_reopened', ({ ticket_id }) => {
          setTickets((prev) =>
            prev
              .map((ticket) =>
                ticket.id === ticket_id
                  ? { ...ticket, status: 'assigned', closure_reason: null, reassigned_to: null }
                  : ticket
              )
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          );
          if (selectedTicket?.id === ticket_id) {
            setSelectedTicket((prev) => ({ ...prev, status: 'assigned', closure_reason: null, reassigned_to: null }));
          }
        });

        socket.on('chat_inactive', ({ ticket_id, reason }) => {
          setTickets((prev) =>
            prev
              .map((ticket) =>
                ticket.id === ticket_id
                  ? { ...ticket, status: 'closed', closure_reason: reason }
                  : ticket
              )
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          );
          if (selectedTicket?.id === ticket_id) {
            setSelectedTicket((prev) => ({ ...prev, status: 'closed', closure_reason: reason }));
          }
        });
      } catch (err) {
        setError('Socket initialization failed: ' + err.message);
      }
    };

    initializeSocket();
    fetchTickets();

    return () => {
      if (socketRef.current) {
        socketRef.current.off('ticket_closed');
        socketRef.current.off('ticket_reopened');
        socketRef.current.off('chat_inactive');
        socketRef.current.off('joined');
      }
    };
  }, [user?.role, navigate, selectedTicket?.id]);

  useEffect(() => {
    const sortedTickets = [...tickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const filtered = sortedTickets.filter((ticket) => {
      const idMatch = ticket.id ? ticket.id.toString().includes(searchFilters.id.toLowerCase()) : true;
      const subjectMatch = ticket.subject ? ticket.subject.toLowerCase().includes(searchFilters.subject.toLowerCase()) : true;
      const categoryMatch = ticket.category ? ticket.category.toLowerCase().includes(searchFilters.category.toLowerCase()) : true;
      const priorityMatch = ticket.priority ? ticket.priority.toLowerCase().includes(searchFilters.priority.toLowerCase()) : true;
      const statusMatch = ticket.status ? ticket.status.toLowerCase().includes(searchFilters.status.toLowerCase()) : true;

      return idMatch && subjectMatch && categoryMatch && priorityMatch && statusMatch;
    });
    setFilteredTickets(filtered);
    setPage(0); // Reset to first page when filters change
  }, [tickets, searchFilters]);

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
      const sortedData = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setTickets(sortedData);
      setFilteredTickets(sortedData);
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
          subject: newTicket.subject,
          category: newTicket.category,
          priority: newTicket.priority,
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
      setNewTicket({ subject: '', category: '', priority: '', description: '' });
      setNotification({
        type: 'success',
        message: 'Ticket created successfully',
      });

      if (socketRef.current) {
        socketRef.current.emit('ticket_created', {
          ticket_id: data.ticket_id,
          user_id: user.id,
          subject: newTicket.subject,
          category: newTicket.category,
          priority: newTicket.priority,
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

  const handleChatClick = (ticket) => {
    navigate(`/user/tickets/${ticket.id}`);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchFilterChange = (field, value) => {
    setSearchFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
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
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
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
          height: 'calc(100vh - 70px)',
          position: 'fixed',
        }}
      >
        <Box
          sx={{
            maxWidth: 1200,
            mx: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            height: '100%',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: '26px' }}>
              My Support Tickets
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{
                bgcolor: '#128C7E',
                '&:hover': { bgcolor: '#075E54' },
              }}
            >
              New Ticket
            </Button>
          </Box>

          <TableContainer
            component={Paper}
            sx={{
              maxHeight: 'calc(100% - 180px)',
              overflowY: 'auto',
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '16px', fontWeight: 'bold', bgcolor: '#128C7E', color: 'white' }}>Ticket ID</TableCell>
                  <TableCell sx={{ fontSize: '16px', fontWeight: 'bold', bgcolor: '#128C7E', color: 'white' }}>Subject</TableCell>
                  <TableCell sx={{ fontSize: '16px', fontWeight: 'bold', bgcolor: '#128C7E', color: 'white' }}>Category</TableCell>
                  <TableCell sx={{ fontSize: '16px', fontWeight: 'bold', bgcolor: '#128C7E', color: 'white' }}>Priority</TableCell>
                  <TableCell sx={{ fontSize: '16px', fontWeight: 'bold', bgcolor: '#128C7E', color: 'white' }}>Status</TableCell>
                  <TableCell sx={{ fontSize: '16px', fontWeight: 'bold', bgcolor: '#128C7E', color: 'white' }}>Action</TableCell>
                </TableRow>
                <TableRow>
                  {['id', 'subject', 'category', 'priority', 'status', ''].map((field) => (
                    <TableCell key={field} sx={{ bgcolor: '#f5f5f5', p: 1 }}>
                      {field ? (
                        <TextField
                          fullWidth
                          size="small"
                          variant="outlined"
                          placeholder={`Filter ${field}`}
                          value={searchFilters[field] || ''}
                          onChange={(e) => handleSearchFilterChange(field, e.target.value)}
                          InputProps={{
                            startAdornment: <SearchIcon fontSize="small" sx={{ color: 'action.active', mr: 1 }} />,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: 'white',
                            },
                          }}
                        />
                      ) : null}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTickets
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((ticket) => (
                    <TableRow key={ticket.id} hover>
                      <TableCell sx={{ fontSize: '16px' }}>{ticket.id}</TableCell>
                      <TableCell sx={{ fontSize: '16px' }}>{ticket.subject}</TableCell>
                      <TableCell sx={{ fontSize: '16px' }}>{ticket.category}</TableCell>
                      <TableCell sx={{ fontSize: '16px' }}>{ticket.priority}</TableCell>
                      <TableCell sx={{ fontSize: '16px' }}>
                        <Button
                          size="small"
                          sx={{
                            color: 'white',
                            bgcolor:
                              ticket.status === 'open' ? '#ff9800' :
                              ticket.status === 'assigned' ? '#4caf50' :
                              ticket.status === 'rejected' ? '#f44336' :
                              ticket.status === 'closed' ? '#2196f3' :
                              ticket.status === 'inactive' ? '#9e9e9e' : 'inherit',
                            '&:hover': {
                              bgcolor:
                                ticket.status === 'open' ? '#fb8c00' :
                                ticket.status === 'assigned' ? '#43a047' :
                                ticket.status === 'rejected' ? '#d32f2f' :
                                ticket.status === 'closed' ? '#1976d2' :
                                ticket.status === 'inactive' ? '#757575' : 'inherit',
                            },
                          }}
                        >
                          {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                        </Button>
                      </TableCell>
                      <TableCell sx={{ fontSize: '16px' }}>
                        {ticket.status === 'assigned' && (
                          <Button
                            startIcon={<ChatIcon />}
                            onClick={() => handleChatClick(ticket)}
                            sx={{
                              color: '#128C7E',
                              '&:hover': {
                                bgcolor: 'rgba(18, 140, 126, 0.1)',
                              },
                            }}
                          >
                            Chat
                          </Button>
                        )}
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
          />
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
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 1, md: 3 },
        }}
      >
        <Paper
          sx={{
            width: { xs: '100%', sm: '90%', md: '80%' },
            height: { xs: '90vh', sm: '80vh' },
            p: { xs: 2, md: 3 },
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" id="chat-modal">
              Ticket #{selectedTicket?.id} - Chat
            </Typography>
            <IconButton
              onClick={() => {
                if (socketRef.current) {
                  socketRef.current.off('joined');
                  socketRef.current.emit('leave', { ticket_id: selectedTicket?.id });
                }
                setSelectedTicket(null);
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          {selectedTicket && (
            <Grid container spacing={2} sx={{ flex: 1 }}>
              <Grid
                item
                xs={12}
                md={4}
                sx={{
                  height: { xs: 'auto', md: '100%' },
                  overflowY: 'auto',
                }}
              >
                <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Ticket Details
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography><strong>Ticket ID:</strong> {selectedTicket.id}</Typography>
                    <Typography><strong>Subject:</strong> {selectedTicket.subject}</Typography>
                    <Typography><strong>User Email:</strong> {selectedTicket.userEmail}</Typography>
                    <Typography><strong>Category:</strong> {selectedTicket.category}</Typography>
                    <Typography><strong>Priority:</strong> {selectedTicket.priority}</Typography>
                    <Typography>
                      <strong>Status:</strong> {selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}
                    </Typography>
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
                          <Typography>
                            <strong>Reassigned To:</strong> Member ID {selectedTicket.reassigned_to}
                          </Typography>
                        )}
                      </>
                    )}
                  </Box>
                </Paper>
              </Grid>
              <Grid
                item
                xs={12}
                md={8}
                sx={{
                  height: { xs: 'auto', md: '100%' },
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                    <ChatWindow
                      ticketId={selectedTicket.id}
                      initialMessages={selectedTicket.chatHistory || []}
                      inactivityTimeout={120000}
                      sx={{ height: '100%' }}
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
            <TextField
              fullWidth
              label="Subject"
              value={newTicket.subject}
              onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              required
            />
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
              <InputLabel>Priority</InputLabel>
              <Select
                value={newTicket.priority}
                label="Priority"
                onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
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
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleCreateTicket}
            variant="contained"
            disabled={!newTicket.subject || !newTicket.category || !newTicket.priority || !newTicket.description}
            sx={{
              bgcolor: '#128C7E',
              '&:hover': { bgcolor: '#075E54' },
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
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
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