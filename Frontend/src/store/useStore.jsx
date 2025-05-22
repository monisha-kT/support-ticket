import { create } from 'zustand';

const getDashboardRoute = (role) => {
  switch (role) {
    case 'user':
      return '/dashboard';
    case 'member':
      return '/dashboard';
    case 'admin':
      return '/dashboard';
    default:
      return '/auth';
  }
};

const useStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  tickets: [],
  messages: [],
  setUser: (user) => {
    set({ user });
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  },
  setTickets: (tickets) => set({ tickets }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  initializeUser: async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await fetch('http://localhost:5000/api/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const userData = await response.json();
          set({ user: userData });
          localStorage.setItem('user', JSON.stringify(userData));
          return { user: userData, route: getDashboardRoute(userData.role) };
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          set({ user: null });
          return { user: null, route: '/auth' };
        }
      } catch (err) {
        console.error('Error initializing user:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null });
        return { user: null, route: '/auth' };
      }
    }
    set({ user: null });
    return { user: null, route: '/auth' };
  },
}));

export default useStore;