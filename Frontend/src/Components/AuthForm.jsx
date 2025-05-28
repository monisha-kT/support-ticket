import React, { useState, useEffect } from 'react';
import {
  Button,
  TextField,
  Typography,
  Box,
  Tabs,
  Tab,
  Snackbar,
  Alert,
} from '@mui/material';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import useStore from '../store/useStore';
import { validateToken } from './socket';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
    background: { default: '#f5f5f5', paper: '#fff' },
    text: {
      primary: '#1F2937',
      secondary: '#6B7280',
    },
  },
  typography: {
    fontFamily: '"Open Sans", sans-serif',
    h4: {
      fontWeight: 700,
      color: '#fff',
      fontSize: { xs: '1.5rem', md: '2rem' },
    },
    body1: { fontSize: '1rem', color: 'rgba(255,255,255,0.8)' },
    body2: { fontSize: '0.9rem', color: '#6B7280' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          padding: '8px 20px',
          fontSize: '0.875rem',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          marginBottom: '8px',
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '& fieldset': {
              borderColor: '#E5E7EB',
            },
            '&:hover fieldset': {
              borderColor: '#1976d2',
            },
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.85rem',
            transform: 'translate(14px, 8px) scale(1)',
            color: '#6B7280',
          },
          '& .MuiInputLabel-shrink': {
            fontSize: '0.75rem',
            transform: 'translate(14px, -6px) scale(0.75)',
            color: '#1976d2',
          },
          '& .MuiOutlinedInput-input': {
            padding: '8px 14px',
            fontSize: '0.85rem',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #E5E7EB',
          marginBottom: '16px',
        },
        indicator: {
          backgroundColor: '#1976d2',
          height: 3,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          fontWeight: 500,
          textTransform: 'none',
          color: '#6B7280',
          '&.Mui-selected': {
            color: '#1976d2',
          },
          padding: '12px 24px',
        },
      },
    },
  },
});

function AuthForm() {
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  const navigate = useNavigate();
  const { setUser, user } = useStore();

  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });
  const showSnackbar = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const getDashboardRoute = (role) => {
    switch (role) {
      case 'user':
      case 'member':
      case 'admin':
        return '/dashboard';
      default:
        return '/auth';
    }
  };

  const handleGoogleLogin = () => {
    try {
      window.location.href = 'http://localhost:5000/api/auth/google';
    } catch (error) {
      console.error('Google login error:', error);
      showSnackbar('Google login failed. Please try again.', 'error');
    }
  };

  const handleFacebookLogin = () => {
    try {
      window.location.href = 'http://localhost:5000/api/auth/facebook';
    } catch (error) {
      console.error('Facebook login error:', error);
      showSnackbar('Facebook login failed. Please try again.', 'error');
    }
  };

  const LoginForm = () => (
    <Formik
      initialValues={{ email: '', password: '' }}
      validationSchema={Yup.object().shape({
        email: Yup.string()
          .email('Invalid email format')
          .required('Email is required'),
        password: Yup.string().required('Password is required'),
      })}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        console.log('Login form submitted with values:', values);
        try {
          const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              email: values.email,
              password: values.password,
            }),
            mode: 'cors',
            credentials: 'include',
          });

          const data = await response.json();

          if (response.ok) {
            localStorage.setItem('token', data.access_token);
            setUser(data.user);
            showSnackbar('Login successful');
            resetForm();
            navigate(getDashboardRoute(data.user.role));
          } else {
            showSnackbar(data.error || `Login failed: ${response.status}`, 'error');
          }
        } catch (error) {
          console.error('Login error:', error);
          showSnackbar('Login failed. Please try again.', 'error');
        }
        setSubmitting(false);
      }}
    >
      {({ isSubmitting, touched, errors }) => (
        <Form>
          <Box sx={{ height: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box>
              <Field
                as={TextField}
                fullWidth
                name="email"
                label="Email"
                helperText={<ErrorMessage name="email" />}
                error={touched.email && !!errors.email}
                variant="outlined"
                margin="normal"
                size="medium"
              />
              <Field
                as={TextField}
                fullWidth
                type="password"
                name="password"
                label="Password"
                helperText={<ErrorMessage name="password" />}
                error={touched.password && !!errors.password}
                variant="outlined"
                margin="normal"
                size="medium"
              />
            </Box>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                startIcon={<GoogleIcon />}
                onClick={handleGoogleLogin}
              >
                Sign in with Google
              </Button>
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                startIcon={<FacebookIcon />}
                onClick={handleFacebookLogin}
              >
                Sign in with Facebook
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Logging in...' : 'Login'}
              </Button>
            </Box>
          </Box>
        </Form>
      )}
    </Formik>
  );

  const SignupForm = () => (
    <Formik
      initialValues={{
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dob: '',
        password: '',
        confirmPassword: '',
      }}
      validationSchema={Yup.object().shape({
        firstName: Yup.string()
          .matches(/^[a-zA-Z\s'-]+$/, 'First name must contain only letters, spaces, or hyphens')
          .min(2, 'First name must be at least 2 characters')
          .max(50, 'First name must be less than 50 characters')
          .required('First name is required'),
        lastName: Yup.string()
          .matches(/^[a-zA-Z\s'-]+$/, 'Last name must contain only letters, spaces, or hyphens')
          .min(2, 'Last name must be at least 2 characters')
          .max(50, 'Last name must be less than 50 characters')
          .required('Last name is required'),
        email: Yup.string()
          .email('Invalid email format')
          .required('Email is required'),
        phone: Yup.string()
          .matches(/^[6-9]\d{9}$/, 'Phone number must be 10 digits starting with 6-9')
          .required('Phone number is required'),
        dob: Yup.date()
          .required('Date of birth is required')
          .test('valid-date', 'Invalid date', (value) =>
            value && moment(value, 'YYYY-MM-DD', true).isValid()
          )
          .test('not-future', 'Date of birth cannot be in the future', (value) =>
            moment(value).isSameOrBefore(moment().startOf('day'))
          )
          .test('age-limit', 'You must be between 18 and 60 years old', (value) => {
            const age = moment().diff(moment(value), 'years');
            return age >= 18 && age <= 60;
          }),
        password: Yup.string()
          .min(8, 'Password must be at least 8 characters')
          .matches(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
            'Password must contain at least one uppercase, one lowercase, one number, and one special character'
          )
          .required('Password is required'),
        confirmPassword: Yup.string()
          .oneOf([Yup.ref('password'), null], 'Passwords must match')
          .required('Confirm password is required'),
      })}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        console.log('Signup form submitted with values:', values);
        try {
          const response = await fetch('http://localhost:5000/api/auth/signup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              firstName: values.firstName,
              lastName: values.lastName,
              dob: values.dob,
              email: values.email,
              phone: values.phone,
              password: values.password,
            }),
            mode: 'cors',
            credentials: 'include',
          });

          const data = await response.json();

          if (response.ok) {
            showSnackbar('Signup successful! Please login.');
            setTab(0);
            resetForm();
          } else {
            console.error('Signup API error:', data.error);
            showSnackbar(data.error || 'Signup failed. Please try again.', 'error');
          }
        } catch (error) {
          console.error('Signup fetch error:', error);
          showSnackbar('Signup failed. Please check your network or try again.', 'error');
        }
        setSubmitting(false);
      }}
    >
      {({ isSubmitting, touched, errors }) => {
        console.log('Signup form errors:', errors);
        return (
          <Form>
            <Box sx={{ height: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box display="flex" gap={1}>
                  <Field
                    as={TextField}
                    name="firstName"
                    label="First Name"
                    helperText={<ErrorMessage name="firstName" />}
                    error={touched.firstName && !!errors.firstName}
                    variant="outlined"
                    fullWidth
                    size="medium"
                  />
                  <Field
                    as={TextField}
                    name="lastName"
                    label="Last Name"
                    helperText={<ErrorMessage name="lastName" />}
                    error={touched.lastName && !!errors.lastName}
                    variant="outlined"
                    fullWidth
                    size="medium"
                  />
                </Box>
                <Field
                  as={TextField}
                  fullWidth
                  type="date"
                  name="dob"
                  label="Date of Birth"
                  helperText={<ErrorMessage name="dob" />}
                  error={touched.dob && !!errors.dob}
                  variant="outlined"
                  size="medium"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ placeholder: 'yyyy-mm-dd' }}
                />
                <Field
                  as={TextField}
                  fullWidth
                  name="email"
                  label="Email"
                  helperText={<ErrorMessage name="email" />}
                  error={touched.email && !!errors.email}
                  variant="outlined"
                  size="medium"
                />
                <Field
                  as={TextField}
                  fullWidth
                  name="phone"
                  label="Phone (e.g., 9876543210)"
                  helperText={<ErrorMessage name="phone" />}
                  error={touched.phone && !!errors.phone}
                  variant="outlined"
                  placeholder="9876543210"
                  size="medium"
                />
                <Box display="flex" gap={1}>
                  <Field
                    as={TextField}
                    fullWidth
                    type="password"
                    name="password"
                    label="Password"
                    helperText={<ErrorMessage name="password" />}
                    error={touched.password && !!errors.password}
                    variant="outlined"
                    size="medium"
                  />
                  <Field
                    as={TextField}
                    fullWidth
                    type="password"
                    name="confirmPassword"
                    label="Confirm Password"
                    helperText={<ErrorMessage name="confirmPassword" />}
                    error={touched.confirmPassword && !!errors.confirmPassword}
                    variant="outlined"
                    size="medium"
                  />
                </Box>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={isSubmitting || Object.keys(errors).length > 0}
                >
                  {isSubmitting ? 'Signing up...' : 'Sign Up'}
                </Button>
              </Box>
            </Box>
          </Form>
        );
      }}
    </Formik>
  );

  useEffect(() => {
    const checkAuth = async () => {
      if (tab === 1) return; // Skip auth check on signup tab
      const token = localStorage.getItem('token');
      if (token && !user) {
        console.log('Validating token:', token);
        const isValid = await validateToken(token);
        if (isValid) {
          try {
            const { user: userData } = await useStore.getState().initializeUser();
            if (userData) {
              console.log('User initialized:', userData);
              navigate(getDashboardRoute(userData.role));
            } else {
              console.error('Failed to initialize user: No user data returned');
              localStorage.removeItem('token');
              setUser(null);
            }
          } catch (error) {
            console.error('Error initializing user:', error);
            localStorage.removeItem('token');
            setUser(null);
          }
        } else {
          console.log('Token invalid, clearing localStorage');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
    };
    checkAuth();
  }, [navigate, setUser, tab]);

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          height: '100vh',
          width: '100vw',
          bgcolor: 'background.default',
          overflow: 'hidden',
          position: 'fixed',
          top: 0,
          left: 0,
        }}
      >
        <Box
          sx={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90vw', sm: '800px' },
            maxWidth: '700px',
            height: { xs: '90vh', sm: '600px' },
            maxHeight: '500px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            borderRadius: 3,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              flex: 1,
              bgcolor: '#128C7E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: { xs: 2, md: 4 },
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ mb: 2, mt: 2 }}>
                {tab === 0 ? 'Login' : 'Sign Up'}
              </Typography>
              <Typography variant="body1" sx={{ maxWidth: 400 }}>
                {tab === 0
                  ? 'Access your account securely.'
                  : 'Join us today to get started!'}
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              flex: 1,
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: { xs: 2, md: 4 },
            }}
          >
            <Box sx={{ width: '100%', maxWidth: 400 }}>
              <Tabs
                value={tab}
                onChange={(e, newVal) => setTab(newVal)}
                centered
                sx={{ mb: 3 }}
              >
                <Tab label="Login" />
                <Tab label="Signup" />
              </Tabs>
              {tab === 0 ? <LoginForm /> : <SignupForm />}
            </Box>
          </Box>
        </Box>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default AuthForm;