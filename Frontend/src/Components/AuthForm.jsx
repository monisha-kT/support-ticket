import React, { useState, useEffect } from "react";
import {
  Button,
  TextField,
  Typography,
  Box,
  Tabs,
  Tab,
  Snackbar,
  Alert,
  Slide,
} from "@mui/material";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import useStore from "../store/useStore";

const theme = createTheme({
  palette: {
    primary: { main: "#1976d2" },
    secondary: { main: "#dc004e" },
    background: { default: "#f5f5f5", paper: "#fff" },
    text: {
      primary: "#1F2937",
      secondary: "#6B7280",
      fontFamily: "times new roman",
    },
  },
  typography: {
    fontFamily: "times new roman",
    h4: {
      fontWeight: 700,
      color: "#fff",
      fontSize: { xs: "1.5rem", md: "2rem" },
    },
    body1: { fontSize: "1rem", color: "rgba(255,255,255,0.8)" },
    body2: { fontSize: "0.9rem", color: "#6B7280" },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          padding: "5px 20px",
          minHeight: "40px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
          },
          "&.MuiButton-containedPrimary": {
            background: "linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)",
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          margin: "4px 0",
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            backgroundColor: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            fontSize: "0.95rem",
            "&:hover fieldset": { borderColor: "#1976d2" },
            "&.Mui-focused fieldset": {
              borderColor: "#1976d2",
              borderWidth: 2,
            },
            "&.Mui-error fieldset": { borderColor: "#dc004e" },
            "&.MuiInputBase-sizeSmall": { height: "40px" },
          },
          "& .MuiInputLabel-root": {
            fontSize: "0.9rem",
            fontWeight: 500,
            color: "#6B7280",
            "&.Mui-focused": { color: "#1976d2" },
            transform: "translate(12px, 10px) scale(1)",
            "&.MuiInputLabel-shrink": {
              transform: "translate(12px, -6px) scale(0.75)",
            },
          },
          minHeight: "54px",
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: 0,
          marginTop: 2,
          fontSize: "0.75rem",
          color: "#dc004e",
          minHeight: "12px",
          lineHeight: "12px",
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { borderBottom: "1px solid #E5E7EB" },
        indicator: { backgroundColor: "#1976d2", height: 3 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontSize: "1rem",
          fontWeight: 500,
          textTransform: "none",
          color: "#6B7280",
          "&.Mui-selected": { color: "#1976d2" },
          padding: "12px 24px",
        },
      },
    },
  },
});

function AuthForm() {
  const [tab, setTab] = useState(0);
  const [step, setStep] = useState(1);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const navigate = useNavigate();
  const { setUser } = useStore.getState();

  // const [token, setToken] = useState(localStorage.getItem('token') || '');

  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });
  const showSnackbar = (message, severity = "success") =>
    setSnackbar({ open: true, message, severity });
  const getDashboardRoute = (role) => {
    if (role === "admin") return "/dashboard";
    if (role === "member") return "/dashboard";
    return "/dashboard";
  };

  const handleLogin = async (values, { setSubmitting }) => {
    const payload = { email: values.email, password: values.password };
    try {
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const body = JSON.stringify(payload);

      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers,
        body,
        mode: "cors",
        credentials: "include",
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Login JSON parse error:", jsonError);
        showSnackbar("Server error: Invalid response format", "error");
        setSubmitting(false);
        return;
      }

      if (response.ok) {
        localStorage.setItem("token", data.access_token);
        setUser(data.user);
        showSnackbar("Login successful");
        const role = data.user.role;
        const route = getDashboardRoute(role);
        navigate(route);
      } else {
        showSnackbar(data.error || `Login failed: ${response.status}`, "error");
      }
    } catch (error) {
      console.error("Login fetch error:", error);
      showSnackbar(`Login failed: ${error.message}`, "error");
    }
    setSubmitting(false);
  };

  const handleSignup = async (values, { setSubmitting }) => {
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      dob: values.dob,
      email: values.email,
      phone: values.phone,
      password: values.password,
    };
    try {
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const body = JSON.stringify(payload);

      const response = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers,
        body,
        mode: "cors",
        credentials: "include",
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Signup JSON parse error:", jsonError);
        showSnackbar("Server error: Invalid response format", "error");
        setSubmitting(false);
        return;
      }

      if (response.ok) {
        // setToken(data.access_token);
        localStorage.setItem("token", data.access_token);
        showSnackbar("Signup successful, please login");
        setTab(0);
        setStep(1);
      } else {
        showSnackbar(
          data.error || `Signup failed: ${response.status}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Signup fetch error:", error);
      showSnackbar(`Signup failed: ${error.message}`, "error");
    }
    setSubmitting(false);
  };

  const [token, setToken] = useState(localStorage.getItem("token") || "");

  useEffect(() => {
    localStorage.getItem("token");
  }, []);

  useEffect(() => {
    if (token) {
      navigate("/dashboard");
    }
  }, [token]);

  const validationSchema = Yup.object().shape({
    firstName: Yup.string()
      .matches(
        /^[a-zA-Z\s'-]+$/,
        "First name must contain only letters and spaces"
      )
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name must be less than 50 characters")
      .required("First name is required"),
    lastName: Yup.string()
      .matches(
        /^[a-zA-Z\s'-]+$/,
        "Last name must contain only letters and spaces"
      )
      .min(2, "Last name must be at least 2 characters")
      .max(50, "Last name must be less than 50 characters")
      .required("Last name is required"),
    email: Yup.string()
      .email("Invalid email format")
      .required("Email is required"),
    phone: Yup.string()
      .matches(
        /^\+[1-9]\d{6,14}$/,
        "Phone number must be (e.g., +919876543210)"
      )
      .required("Phone number is required"),
    dob: Yup.date()
      .required("Date of birth is required")
      .test(
        "valid-date",
        "Invalid date",
        (value) => value && moment(value, "YYYY-MM-DD", true).isValid()
      )
      .test("not-future", "Date of birth cannot be in the future", (value) =>
        moment(value).isSameOrBefore(moment().startOf("day"))
      )
      .test("age-limit", "You must be between 18 and 60 years old", (value) => {
        const age = moment().diff(moment(value), "years");
        return age >= 18 && age <= 60;
      }),
    password: Yup.string()
      .min(8, "Password must be at least 8 characters")
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password must contain at least one uppercase, one lowercase, one number and one special character"
      )
      .required("Password is required"),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref("password"), null], "Passwords must match")
      .required("Confirm password is required"),
  });

  const loginValidationSchema = Yup.object().shape({
    email: Yup.string()
      .email("Invalid email format")
      .required("Email is required"),
    password: Yup.string().required("Password is required"),
  });

  const renderLogin = ({ touched, errors }) => (
    <Slide direction="right" in>
      <Box
        display="flex"
        flexDirection="column"
        gap={2}
        sx={{ width: "100%", minHeight: "200px" }}
      >
        <Field
          as={TextField}
          fullWidth
          name="email"
          label="Email"
          helperText={<ErrorMessage name="email" />}
          error={touched.email && !!errors.email}
          variant="outlined"
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
        />
        <Button type="submit" variant="contained" color="#128C7E" fullWidth>
          Login
        </Button>
      </Box>
    </Slide>
  );

  const renderSignup = ({ values, touched, errors }) => (
    <Slide direction="up" in>
      <Box
        display="flex"
        flexDirection="column"
        gap={1.5}
        sx={{ width: "100%", height: "400px" }}
      >
        {step === 1 && (
          <>
            <Box display="flex" gap={1.5}>
              <Field
                as={TextField}
                name="firstName"
                label="First Name"
                helperText={<ErrorMessage name="firstName" />}
                error={touched.firstName && !!errors.firstName}
                variant="outlined"
                size="small"
                sx={{
                  flex: 1,
                  "& .MuiInputBase-input": { padding: "10px 14px" },
                }}
              />
              <Field
                as={TextField}
                name="lastName"
                label="Last Name"
                helperText={<ErrorMessage name="lastName" />}
                error={touched.lastName && !!errors.lastName}
                variant="outlined"
                size="small"
                sx={{
                  flex: 1,
                  "& .MuiInputBase-input": { padding: "10px 14px" },
                }}
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
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={{ "& .MuiInputBase-input": { padding: "10px 14px" } }}
            />
            <Field
              as={TextField}
              fullWidth
              name="email"
              label="Email"
              helperText={<ErrorMessage name="email" />}
              error={touched.email && !!errors.email}
              variant="outlined"
              size="small"
              sx={{ "& .MuiInputBase-input": { padding: "10px 14px" } }}
            />
            <Box display="flex" gap={1.5}>
              <Field
                as={TextField}
                fullWidth
                type="password"
                name="password"
                label="Password"
                helperText={<ErrorMessage name="password" />}
                error={touched.password && !!errors.password}
                variant="outlined"
                size="small"
                sx={{ "& .MuiInputBase-input": { padding: "10px 14px" } }}
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
                size="small"
                sx={{ "& .MuiInputBase-input": { padding: "10px 14px" } }}
              />
            </Box>
            <Button
              variant="contained"
              color="#128C7E"
              onClick={() => setStep(2)}
              fullWidth
              disabled={
                !values.firstName ||
                !values.lastName ||
                !values.dob ||
                !values.email ||
                !values.password ||
                !values.confirmPassword ||
                !!errors.firstName ||
                !!errors.lastName ||
                !!errors.dob ||
                !!errors.email ||
                !!errors.password ||
                !!errors.confirmPassword
              }
              sx={{ mt: 1, color: "#128C7E" }}
            >
              Next
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Field
              as={TextField}
              fullWidth
              name="phone"
              label="Phone (e.g., +919876543210)"
              helperText={<ErrorMessage name="phone" />}
              error={touched.phone && !!errors.phone}
              variant="outlined"
              placeholder="+919876543210"
            />
            <Button type="submit" variant="contained" color="#128C7E" fullWidth>
              Sign Up
            </Button>
          </>
        )}
      </Box>
    </Slide>
  );

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          height: "100vh",
          width: "100vw",
          bgcolor: "background.default",
          overflow: "hidden",
          position: "fixed",
          top: 0,
          left: 0,
        }}
      >
        <Box
          sx={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "90vw", sm: "800px" },
            maxWidth: "700px",
            height: { xs: "90vh", sm: "600px" },
            maxHeight: "500px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            borderRadius: 3,
            display: "flex",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              flex: 1,
              bgcolor: "#128C7E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: { xs: 2, md: 4 },
            }}
          >
            <Slide direction="down" in>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h4" sx={{ mb: 2 }}>
                  {tab === 0 ? "Login" : "Sign Up"}
                </Typography>
                <Typography variant="body1" sx={{ maxWidth: 400 }}>
                  {tab === 0
                    ? "Access your account securely."
                    : "Join us today to get started!"}
                </Typography>
              </Box>
            </Slide>
          </Box>
          <Box
            sx={{
              flex: 1,
              bgcolor: "background.paper",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: { xs: 2, md: 4 },
              overflow: "hidden",
            }}
          >
            <Box sx={{ width: "100%", maxWidth: { xs: 360, sm: 400 } }}>
              <Formik
                initialValues={{
                  firstName: "",
                  lastName: "",
                  email: "",
                  phone: "",
                  dob: "",
                  password: "",
                  confirmPassword: "",
                }}
                validationSchema={
                  tab === 0 ? loginValidationSchema : validationSchema
                }
                onSubmit={tab === 0 ? handleLogin : handleSignup}
                validateOnChange
                validateOnBlur
              >
                {({ values, touched, errors }) => (
                  <Form>
                    <Box sx={{ mb: 3 }}>
                      <Tabs
                        value={tab}
                        onChange={(e, newVal) => {
                          setTab(newVal);
                          setStep(1);
                        }}
                        centered
                      >
                        <Tab label="Login" />
                        <Tab label="Signup" />
                      </Tabs>
                    </Box>
                    <Box>
                      {tab === 0
                        ? renderLogin({ touched, errors })
                        : renderSignup({ values, touched, errors })}
                    </Box>
                  </Form>
                )}
              </Formik>
            </Box>
          </Box>
        </Box>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          TransitionComponent={Slide}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            variant="filled"
            sx={{
              width: "100%",
              borderRadius: 10,
              boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default AuthForm;
