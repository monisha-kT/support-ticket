import React, { useState } from 'react';
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Divider,
  Paper,
  Snackbar,
  Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import moment from 'moment';

function UserProfile() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const navigate = useNavigate();

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleDialogOpen = () => {
    setDialogOpen(true);
    handleClose();
  };
  const handleDialogClose = () => setDialogOpen(false);
  const handleChangePasswordOpen = () => {
    setChangePasswordOpen(true);
    setError('');
    setSuccessMessage('');
    handleClose();
  };
  const handleChangePasswordClose = () => {
    setChangePasswordOpen(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMessage('');
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const handleLogout = async () => {
    await fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    setUser(null);
    localStorage.removeItem('token');
    navigate('/');
  };

  const handleChangePassword = async () => {
    try {
      setError('');
      setSuccessMessage('');

      // Validation checks
      if (!oldPassword || !newPassword || !confirmPassword) {
        setError('All fields are required');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        return;
      }

      if (!newPassword.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)) {
        setError('Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      const res = await fetch('http://localhost:5000/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          oldPassword,
          newPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setSuccessMessage('Password changed successfully');
      setSnackbarOpen(true);
      setTimeout(() => {
        handleChangePasswordClose();
      }, 2000);

    } catch (err) {
      setError(err.message || 'Failed to change password');
      setSnackbarOpen(true);
    }
  };

  // DOB validation logic
  const validateDOB = (dob) => {
    if (!dob) return 'Date of birth is missing';
    
    const isValidDate = moment(dob, 'YYYY-MM-DD', true).isValid();
    if (!isValidDate) return 'Invalid date format';

    const isNotFuture = moment(dob).isSameOrBefore(moment().startOf('day'));
    if (!isNotFuture) return 'Date of birth cannot be in the future';

    const age = moment().diff(moment(dob), 'years');
    if (age < 18) return 'You must be at least 18 years old';
    if (age > 60) return 'You must be less than 60 years old';

    return null;
  };

  const displayName = user?.firstName || 'User';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const dobError = validateDOB(user?.dob);

  return (
    <>
      <Avatar
        sx={{
          bgcolor: '#128C7E',
          width: 36,
          height: 36,
          cursor: 'pointer',
          fontSize: '1rem',
          borderRadius: '50%',
          border: '2px solid white',
          '&:hover': {
            transform: 'scale(1.05)',
            transition: 'transform 0.2s'
          }
        }}
        onClick={handleClick}
      >
        {avatarLetter}
      </Avatar>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: { mt: 1, minWidth: 150, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' },
        }}
      >
        <MenuItem onClick={handleDialogOpen}>View Profile</MenuItem>
        <MenuItem onClick={handleChangePasswordOpen}>Change Password</MenuItem>
        <MenuItem onClick={handleLogout}>Logout</MenuItem>
      </Menu>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={error ? 'error' : 'success'}
          sx={{ width: '100%' }}
          elevation={6}
          variant="filled"
        >
          {error || successMessage}
        </Alert>
      </Snackbar>

      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#128C7E', color: 'white', display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
          <Avatar sx={{ bgcolor: 'white', color: '#128C7E', width: 40, height: 40 }}>{avatarLetter}</Avatar>
          <Typography variant="h6">User Profile</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Paper elevation={0} sx={{ m: 2, borderRadius: 2, border: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2,fontFamily:'times new roman' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' ,fontFamily:'times new roman'}}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1,fontFamily:'times new roman' }}>
                  First Name
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ flex: 1, textAlign: 'right' ,fontFamily:'times new roman'}}>
                  {user?.firstName || 'N/A'}
                </Typography>
              </Box>
              <Divider sx={{ bgcolor: '#e0e0e0' }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' ,fontFamily:'times new roman'}}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1,fontFamily:'times new roman' }}>
                  Last Name
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ flex: 1, textAlign: 'right',fontFamily:'times new roman' }}>
                  {user?.lastName || 'N/A'}
                </Typography>
              </Box>
              <Divider sx={{ bgcolor: '#e0e0e0' }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 ,fontFamily:'times new roman'}}>
                  Email
                </Typography>
                <Typography
                  variant="body1"
                  fontWeight={500}
                  sx={{ flex: 1, textAlign: 'right', overflowWrap: 'break-word',fontFamily:'times new roman' }}
                >
                  {user?.email || 'N/A'}
                </Typography>
              </Box>
              <Divider sx={{ bgcolor: '#e0e0e0' }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',fontFamily:'times new roman' }}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1,fontFamily:'times new roman' }}>
                  Phone
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ flex: 1, textAlign: 'right' ,fontFamily:'times new roman'}}>
                  {user?.phone || 'N/A'}
                </Typography>
              </Box>
              <Divider sx={{ bgcolor: '#e0e0e0' }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',fontFamily:'times new roman' }}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1,fontFamily:'times new roman' }}>
                  Date of Birth
                </Typography>
                <Typography
                  variant="body1"
                  fontWeight={500}
                  sx={{
                    flex: 1,
                    textAlign: 'right',
                    color: dobError ? 'error.main' : 'text.primary',
                    fontFamily:'times new roman'
                  }}
                >
                  {dobError || (user?.dob ? moment(user.dob).format('MMM D, YYYY') : 'N/A')}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={handleDialogClose}
            variant="contained"
            sx={{
              bgcolor: '#128C7E',
              color: 'white',
              fontFamily:'times new roman',
              textTransform: 'none',
              
              '&:hover': { bgcolor: '#129C7E' },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={changePasswordOpen}
        onClose={handleChangePasswordClose}
        maxWidth="xs"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            width: { xs: '90%', sm: 400 },
            maxWidth: 400,
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: '#128C7E',
            color: 'white',
            py: { xs: 1, sm: 1.5 },
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' ,fontFamily:'times new roman'} }}>
            Change Password
          </Typography>
        </DialogTitle>
        <DialogContent
          sx={{
            p: { xs: 2, sm: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 1.5, sm: 2 },
          }}
        >
          <TextField
            label="Old Password"
            type="password"
            fullWidth
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            variant="outlined"
            size="small"
            sx={{
              '& .MuiInputBase-input': {
                fontSize: { xs: '0.875rem', sm: '0.95rem' },
                padding: { xs: '8px 12px', sm: '10px 14px' },
              },
              '& .MuiInputLabel-root': {
                fontSize: { xs: '0.875rem', sm: '0.9rem' },
              },
              fontFamily:'times new roman'
            }}
          />
          <TextField
            label="New Password"
            type="password"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            variant="outlined"
            size="small"
            sx={{
              '& .MuiInputBase-input': {
                fontSize: { xs: '0.875rem', sm: '0.95rem' },
                padding: { xs: '8px 12px', sm: '10px 14px' },
              },
              '& .MuiInputLabel-root': {
                fontSize: { xs: '0.875rem', sm: '0.9rem' },
              },
              fontFamily:'times new roman'
            }}
          />
          <TextField
            label="Confirm New Password"
            type="password"
            fullWidth
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            variant="outlined"
            size="small"
            sx={{
              '& .MuiInputBase-input': {
                fontSize: { xs: '0.875rem', sm: '0.95rem' },
                padding: { xs: '8px 12px', sm: '10px 14px' },
              },
              '& .MuiInputLabel-root': {
                fontSize: { xs: '0.875rem', sm: '0.9rem' },
              },
              fontFamily:'times new roman'
            }}
          />
        </DialogContent>
        <DialogActions
          sx={{
            p: { xs: 1, sm: 2 },
            justifyContent: 'center',
            gap: { xs: 1, sm: 2 },
          }}
        >
          <Button
            onClick={handleChangePasswordClose}
            variant="outlined"
            sx={{
              borderColor: '#128C7E',
              color: '#128C7E',
              textTransform: 'none',
              width: { xs: 80, sm: 100 },
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              '&:hover': { borderColor: '#129C7E', color: '#129C7E' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleChangePassword}
            variant="contained"
            sx={{
              bgcolor: '#128C7E',
              color: 'white',
              textTransform: 'none',
              width: { xs: 80, sm: 100 },
              fontFamily:'times new roman',
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              '&:hover': { bgcolor: '#129C7E' },
            }}
          >
            Change
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default UserProfile;
