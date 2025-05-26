import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Button, Container, Paper, Modal, Grid, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  TextField, IconButton, Badge
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { getSocket } from './socket';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import ChatWindow from './ChatWindow';
import NotificationDrawer from './NotificationDrawer';

function AdminDashboard() {
  const gridRef = useRef();
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reassignTicketId, setReassignTicketId] = useState(null);
  const [closeTicketId, setCloseTicketId] = useState(null);
  const [reassignTo, setReassignTo] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();

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

    const socket = getSocket();
    if (socket) {
      socket.on('new_ticket', fetchTickets);
      socket.on('ticket_closed', ({ ticket_id, reason, reassigned_to }) => {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? { ...ticket, status: 'closed', closure_reason: reason, reassigned_to }
              : ticket
          )
        );
        setNotifications((prev) => [
          ...prev,
          { type: 'info', message: `Ticket #${ticket_id} closed: ${reason}` }
        ]);
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
      socket.on('ticket_reassigned', ({ ticket_id, assigned_to }) => {
        const member = members.find(m => m.id === assigned_to);
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? {
                  ...ticket,
                  assigned_to,
                  memberName: member ? `${member.first_name} ${member.last_name}` : 'Unassigned'
                }
              : ticket
          )
        );
        setNotifications((prev) => [
          ...prev,
          { type: 'info', message: `Ticket #${ticket_id} reassigned to ${member ? `${member.first_name} ${member.last_name}` : 'Unassigned'}` }
        ]);
      });
    }

    fetchTickets();
    fetchMembers();

    return () => {
      if (socket) {
        socket.off('new_ticket');
        socket.off('ticket_closed');
        socket.off('ticket_reopened');
        socket.off('chat_inactive');
        socket.off('ticket_reassigned');
        socket.disconnect();
      }
    };
  }, [user, navigate, members]);

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

  const fetchChats = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/chats/${ticketId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Failed to fetch chats: ${errorData.message || res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      setError('Failed to fetch chat history');
      return [];
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
      setTickets(ticketsWithDetails);
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
      const [userRes, chatHistory] = await Promise.all([
        fetch(`http://localhost:5000/api/users/${ticket.user_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchChats(ticket.id)
      ]);
      if (!userRes.ok) throw new Error('Failed to fetch user details');
      const userData = await userRes.json();
      if (ticket.id !== ticketId) return; // Prevent race condition
      setSelectedTicketDetails({
        ...ticket,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email,
      });
      setSelectedTicket({
        ...ticket,
        chats: chatHistory,
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
        body: JSON.stringify({ reassign_to: parseInt(reassignTo) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const socket = getSocket();
      socket.emit('ticket_reassigned', { ticket_id: reassignTicketId, assigned_to: parseInt(reassignTo) });
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
      const socket = getSocket();
      socket.emit('ticket_closed', { ticket_id: closeTicketId, reason: closeReason || 'Closed by admin' });
      setCloseDialogOpen(false);
      setCloseReason('');
      setCloseTicketId(null);
      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const columnDefs = [
    { field: 'id', headerName: 'Ticket ID', flex: 1, minWidth: 100, floatingFilter: true },
    { field: 'category', headerName: 'Category', flex: 1, minWidth: 120, floatingFilter: true },
    { field: 'priority', headerName: 'priority', flex: 1, minWidth: 100, floatingFilter: true },
    { field: 'subject', headerName: 'Subject', flex: 1, minWidth: 150, floatingFilter: true },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      minWidth: 100,
      floatingFilter: true,
      cellRenderer: (params) => (
        <Typography
          sx={{
            bgcolor:
              params.value === 'open'
                ? 'warning.main'
                : params.value === 'assigned'
                ? 'info.main'
                : params.value === 'rejected'
                ? 'error.main'
                : params.value === 'closed'
                ? 'success.main'
                : 'inherit',
            color: 'white',
            px: 2,
            py: 0.5,
            borderRadius: 1,
            display: 'inline-block',
          }}
        >
          {params.value.charAt(0).toUpperCase() + params.value.slice(1)}
        </Typography>
      ),
    },
    {
      field: 'last_message_at',
      headerName: 'Last Response',
      flex: 1,
      minWidth: 180,
      valueFormatter: (params) =>
        params.value
          ? new Date(params.value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
          : 'N/A',
    },
    { field: 'activeStatus', headerName: 'Active Status', flex: 1, minWidth: 120, floatingFilter: true },
    {
      field: 'closure_reason',
      headerName: 'Closure Reason',
      flex: 1,
      minWidth: 150,
      floatingFilter: true,
      cellRenderer: (params) => params.value || 'N/A'
    },
    { field: 'userName', headerName: 'Created By', flex: 1, minWidth: 150, floatingFilter: true },
    { field: 'memberName', headerName: 'Assigned To', flex: 1, minWidth: 150, floatingFilter: true },
    {
      headerName: 'Actions',
      minWidth: 250,
      cellRenderer: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => handleViewDetails(params.data)}
          >
            View Details
          </Button>
          {params.data.status !== 'closed' && params.data.status !== 'rejected' && (
            <>
              <Button
                variant="contained"
                size="small"
                color="secondary"
                onClick={() => {
                  setReassignTicketId(params.data.id);
                  setReassignDialogOpen(true);
                }}
              >
                Reassign
              </Button>
              <Button
                variant="contained"
                size="small"
                color="error"
                onClick={() => {
                  setCloseTicketId(params.data.id);
                  setCloseDialogOpen(true);
                }}
              >
                Close
              </Button>
            </>
          )}
        </Box>
      ),
    },
  ];

  const defaultColDef = {
    sortable: true,
    filter: true,
  };

  return (
    <>
      <Navbar />
      <Box sx={{ mt: '64px', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
        <Box sx={{ p: 2, marginBottom: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Admin Dashboard
            </Typography>
            <IconButton onClick={() => setNotificationDrawerOpen(true)}>
              <Badge badgeContent={notifications.length} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Box>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        ) : (
          <Box sx={{ flex: 1, p: 2, position: 'relative' }}>
            <Box
              className="ag-theme-alpine"
              sx={{
                height: '100%',
                width: '100%',
                '& .ag-header-cell': { backgroundColor: '#f5f5f5', fontWeight: 'bold' },
                '& .ag-cell': { display: 'flex', alignItems: 'center' },
              }}
            >
              <AgGridReact
                ref={gridRef}
                rowData={tickets}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                pagination
                paginationPageSize={10}
                animateRows={true}
              />
            </Box>
          </Box>
        )}
        <Modal
          open={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-labelledby="ticket-details-modal"
          aria-describedby="ticket-details-description"
        >
          <Paper sx={{ width: '90%', height: '90vh', maxWidth: 1200, p: 3, position: 'relative', overflow: 'hidden' }}>
            {detailsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : selectedTicket && (
              <Grid container spacing={2} sx={{ height: '100%' }}>
                <Grid item xs={4}>
                  <Paper elevation={2} sx={{ p: 2, height: '100%', overflow: 'auto' }}>
                    <Typography variant="h6" gutterBottom id="ticket-details-modal">Ticket Details</Typography>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} id="ticket-details-description">
                      <Typography><strong>Ticket ID:</strong> #{selectedTicket.id}</Typography>
                      <Typography><strong>Subject:</strong> {selectedTicket.subject}</Typography>
                      <Typography><strong>Created By:</strong> {selectedTicketDetails?.userName || 'Loading...'}</Typography>
                      <Typography><strong>User Email:</strong> {selectedTicketDetails?.userEmail || 'Loading...'}</Typography>
                      <Typography><strong>Category:</strong> {selectedTicket.category}</Typography>
                      <Typography><strong>priority:</strong> {selectedTicket.priority}</Typography>
                      <Typography><strong>Status:</strong> {selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}</Typography>
                      <Typography><strong>Active Status:</strong> {selectedTicket.activeStatus}</Typography>
                      {selectedTicket.closure_reason && (
                        <Typography><strong>Closure Reason:</strong> {selectedTicket.closure_reason}</Typography>
                      )}
                      {selectedTicket.reassigned_to && (
                        <Typography><strong>Reassigned To:</strong> Member ID {selectedTicket.reassigned_to}</Typography>
                      )}
                      <Typography><strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}</Typography>
                      <Typography><strong>Description:</strong></Typography>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                        {selectedTicket.description}
                      </Paper>
                      {selectedTicket.assigned_to && (
                        <>
                          <Typography><strong>Current Status:</strong></Typography>
                          <Alert
                            severity={
                              selectedTicket.status === 'open' ? 'warning' :
                              selectedTicket.status === 'assigned' ? 'info' :
                              selectedTicket.status === 'rejected' ? 'error' : 'success'
                            }
                          >
                            {selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}
                          </Alert>
                        </>
                      )}
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={8}>
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6">Chat History</Typography>
                      <Button variant="outlined" onClick={() => setSelectedTicket(null)}>
                        Close
                      </Button>
                    </Box>
                    <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                      <ChatWindow
                        ticketId={selectedTicket.id}
                        readOnly={false}
                        initialMessages={selectedTicket.chats}
                      />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Paper>
        </Modal>
        <Dialog open={reassignDialogOpen} onClose={() => setReassignDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Reassign Ticket</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Reassign To</InputLabel>
                <Select
                  value={reassignTo}
                  label="Reassign To"
                  onChange={(e) => setReassignTo(e.target.value)}
                >
                  <MenuItem value="">Select Member</MenuItem>
                  {members.map(member => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReassignDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleReassignTicket}
              disabled={!reassignTo}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
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
                placeholder="Enter reason for closing the ticket"
              />
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
        />
      </Box>
    </>
  );
}

export default AdminDashboard;