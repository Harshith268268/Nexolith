import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { FamilyMember, Report, Alert, Prediction } from './mockData';
import localforage from 'localforage';

// Dynamic API URL: Uses Cloud when deployed, Localhost when developing
export const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001'; 

interface AuthState {
  token: string | null;
  familyId: number | null;
  username: string | null;
}

interface FamilyContextType {
  // Auth
  auth: AuthState;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  authError: string | null;
  authLoading: boolean;

  // Family Data
  members: FamilyMember[];
  activeMember: FamilyMember | null;
  setActiveMember: (member: FamilyMember | null) => void;
  addMember: (data: Omit<FamilyMember, 'id' | 'reportCount' | 'overallRisk' | 'lastReportDate'>) => Promise<void>;
  updateMember: (id: string, data: Partial<FamilyMember>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;

  reports: Report[];
  addReport: (data: Omit<Report, 'id'>) => Promise<Report>;

  alerts: Alert[];
  addAlert: (data: Omit<Alert, 'id'>) => Promise<void>;
  markAlertRead: (id: string) => Promise<void>;
  rescheduleAlert: (id: string, newDate: string) => Promise<void>;

  dataLoading: boolean;
  refreshData: () => Promise<void>;

  // AI Predictions
  predictions: Prediction[];
  predictionsLoading: boolean;
  fetchPredictions: (force?: boolean) => Promise<void>;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

function getStoredAuth(): AuthState {
  try {
    const raw = localStorage.getItem('healthai_auth');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { token: null, familyId: null, username: null };
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(getStoredAuth);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [activeMember, setActiveMember] = useState<FamilyMember | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [predictionsFetched, setPredictionsFetched] = useState(false);

  const isAuthenticated = Boolean(auth.token);

  const apiFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };
    if (auth.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      logout();
      throw new Error('Session expired. Please log in again.');
    }
    return res;
  }, [auth.token]);

  const refreshData = useCallback(async () => {
    if (!auth.token || !auth.familyId) return;
    setDataLoading(true);

    // Attempt to load from offline cache first for instant UI updates
    try {
      const cachedData: any = await localforage.getItem(`healthai_data_${auth.familyId}`);
      if (cachedData) {
        const fetchedMembers: FamilyMember[] = cachedData.members || [];
        setMembers(fetchedMembers);
        setReports(cachedData.reports || []);
        setAlerts(cachedData.alerts || []);
        setActiveMember(prev => {
          if (prev) {
            const updated = fetchedMembers.find(m => m.id === prev.id);
            return updated || (fetchedMembers[0] || null);
          }
          return fetchedMembers[0] || null;
        });
      }
    } catch (err) {
      console.error('Failed to load from cache', err);
    }

    try {
      const res = await apiFetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        // Update offline cache
        await localforage.setItem(`healthai_data_${auth.familyId}`, data);
        
        const fetchedMembers: FamilyMember[] = data.members || [];
        setMembers(fetchedMembers);
        setReports(data.reports || []);
        setAlerts(data.alerts || []);
        setActiveMember(prev => {
          if (prev) {
            const updated = fetchedMembers.find(m => m.id === prev.id);
            return updated || (fetchedMembers[0] || null);
          }
          return fetchedMembers[0] || null;
        });
      }
    } catch (err) {
      console.error('Failed to refresh data from server. Continuing with cached data if available.', err);
    } finally {
      setDataLoading(false);
    }
  }, [auth.token, auth.familyId, apiFetch]);

  const fetchPredictions = useCallback(async (force = false) => {
    if (!auth.token || !auth.familyId) return;
    if (predictionsFetched && !force) return;
    setPredictionsLoading(true);
    try {
      const res = await apiFetch('/api/predictions');
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predictions || []);
        setPredictionsFetched(true);
      }
    } catch (err) {
      console.error('Failed to fetch predictions', err);
    } finally {
      setPredictionsLoading(false);
    }
  }, [auth.token, auth.familyId, apiFetch, predictionsFetched]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    } else {
      setMembers([]);
      setReports([]);
      setAlerts([]);
      setActiveMember(null);
      setPredictions([]);
      setPredictionsFetched(false);
    }
  }, [isAuthenticated]);

  const persistAuth = (state: AuthState) => {
    setAuth(state);
    localStorage.setItem('healthai_auth', JSON.stringify(state));
  };

  const login = async (username: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      persistAuth({ token: data.token, familyId: data.familyId, username: data.username });
    } catch (err: any) {
      setAuthError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  const register = async (username: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      persistAuth({ token: data.token, familyId: data.familyId, username: data.username });
    } catch (err: any) {
      setAuthError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('healthai_auth');
    setAuth({ token: null, familyId: null, username: null });
    setMembers([]);
    setReports([]);
    setAlerts([]);
    setActiveMember(null);
    setPredictions([]);
    setPredictionsFetched(false);
  };

  const addMember = async (data: Omit<FamilyMember, 'id' | 'reportCount' | 'overallRisk' | 'lastReportDate'>) => {
    const res = await apiFetch('/api/members', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add member');
    }
    const newMember: FamilyMember = await res.json();
    setMembers(prev => [...prev, newMember]);
    if (!activeMember) setActiveMember(newMember);
  };

  const updateMember = async (id: string, data: Partial<FamilyMember>) => {
    const res = await apiFetch(`/api/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update member');
    }
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
    if (activeMember?.id === id) {
      setActiveMember(prev => prev ? { ...prev, ...data } : null);
    }
  };

  const deleteMember = async (id: string) => {
    const res = await apiFetch(`/api/members/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete member');
    }
    setMembers(prev => prev.filter(m => m.id !== id));
    setReports(prev => prev.filter(r => r.memberId !== id));
    setAlerts(prev => prev.filter(a => a.memberId !== id));
    if (activeMember?.id === id) {
      setActiveMember(members.find(m => m.id !== id && m.relation === 'Primary') || members.find(m => m.id !== id) || null);
    }
  };

  const addReport = async (data: Omit<Report, 'id'>): Promise<Report> => {
    const res = await apiFetch('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ ...data, memberId: data.memberId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save report');
    }
    const newReport: Report = await res.json();
    setReports(prev => [newReport, ...prev]);
    // Refresh member data to update reportCount & overallRisk
    refreshData();
    return newReport;
  };

  const addAlert = async (data: Omit<Alert, 'id'>) => {
    const res = await apiFetch('/api/alerts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create alert');
    }
    const newAlert: Alert = await res.json();
    setAlerts(prev => [newAlert, ...prev]);
  };

  const markAlertRead = async (id: string) => {
    const res = await apiFetch(`/api/alerts/${id}/read`, { method: 'PUT' });
    if (res.ok) {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true, status: 'History' } : a));
    }
  };

  const rescheduleAlert = async (id: string, newDate: string) => {
    const res = await apiFetch(`/api/alerts/${id}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify({ date: newDate })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reschedule alert');
    }
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, date: newDate } : a));
  };

  return (
    <FamilyContext.Provider value={{
      auth, isAuthenticated, login, register, logout, authError, authLoading,
      members, activeMember, setActiveMember, addMember, updateMember, deleteMember,
      reports, addReport,
      alerts, addAlert, markAlertRead, rescheduleAlert,
      dataLoading, refreshData,
      predictions, predictionsLoading, fetchPredictions
    }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) throw new Error('useFamily must be used within a FamilyProvider');
  return context;
}