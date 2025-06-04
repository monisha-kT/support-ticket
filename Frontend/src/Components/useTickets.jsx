import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';

const useTickets = (dashboardType) => {
  const navigate = useNavigate();
  
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Search filters state (all lowercase for case-insensitive match)
  const [searchFilters, setSearchFilters] = useState({
    id: '',
    subject: '',
    category: '',
    priority: '',
    status: '',
    userName: '',
    memberName: '',
    description: '',
    createdAt: '',
    created_at: '',
    lastMessageAt: '',
    lastResponseTime: '',
    activeStatus: '',
    closure_reason: '',
  });

  // Fetch tickets function
  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/auth');
        return;
      }
      
      const response = await fetch('http://localhost:5000/api/tickets', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch tickets: ${response.statusText}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Invalid data format: Expected an array of tickets');
      }

      setTickets(data);
      setFilteredTickets(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Fetch tickets error:', err);
      if (err.message.includes('Unauthorized')) {
        localStorage.removeItem('token');
        navigate('/auth');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Debounced fetchTickets to avoid too many calls
  const debouncedFetchTickets = useCallback(debounce(fetchTickets, 500), [fetchTickets]);

  // Update search filter values
  const handleSearchChange = useCallback((field, value) => {
    setSearchFilters((prev) => ({
      ...prev,
      [field]: value.toLowerCase(),
    }));
  }, []);

  // Filter tickets based on searchFilters
  useEffect(() => {
    if (!tickets || tickets.length === 0) {
      setFilteredTickets([]);
      return;
    }

    const filtered = tickets.filter((ticket) => {
      return Object.entries(searchFilters).every(([key, value]) => {
        if (!value) return true; // skip empty filters
        const ticketValue = String(ticket[key] || '').toLowerCase();
        return ticketValue.includes(value);
      });
    });

    setFilteredTickets(filtered);
  }, [tickets, searchFilters]);

  // Initial fetch on mount (or whenever debouncedFetchTickets changes)
  useEffect(() => {
    debouncedFetchTickets();
    // Cancel debounce on unmount
    return () => debouncedFetchTickets.cancel();
  }, [debouncedFetchTickets]);

  return {
    tickets,
    filteredTickets,
    loading,
    error,
    searchFilters,
    handleSearchChange,
    fetchTickets: debouncedFetchTickets,
  };

// return {
//   tickets: [],
//   filteredTickets: [],
//   loading: false,
//   error: null,
//   searchFilters: {},
//   handleSearchChange: () => {},
//   fetchTickets: () => {},
// };
};

export default useTickets;
