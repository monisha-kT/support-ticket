import { create } from 'zustand';
import { validateToken } from '../Components/socket'; // Adjust path as per your project structure

const useStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  tickets: [],
  messages: [],
  setUser: (user) => {
    set({ user });
    if (user) {
      console.info('Storing user in localStorage:', user.email);
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      console.info('Clearing user and token from localStorage');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  },
  setTickets: (tickets) => set({ tickets }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  initializeUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.info('No token found in localStorage, setting user to null');
      set({ user: null });
      return { user: null };
    }

    try {
      console.info('Validating token with /api/auth/validate');
      const response = await fetch('http://localhost:5000/api/auth/validate', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (response.ok && data.valid && data.user) {
        console.info('User initialized successfully:', data.user.email);
        set({ user: data.user });
        localStorage.setItem('user', JSON.stringify(data.user));
        return { user: data.user };
      } else {
        console.warn('Token validation failed:', data.error || 'Invalid response');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null });
        return { user: null };
      }
    } catch (err) {
      console.error('Error initializing user:', err.message);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ user: null });
      return { user: null };
    }
  },
}));

export default useStore;