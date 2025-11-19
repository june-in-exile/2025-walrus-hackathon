'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type UserRole = 'buyer' | 'seller' | 'auditor';

interface RoleContextType {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>('buyer');

  const setRole = (role: UserRole) => {
    setCurrentRole(role);
    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('dev-user-role', role);
    }
  };

  // Load from localStorage on mount
  if (typeof window !== 'undefined' && !currentRole) {
    const stored = localStorage.getItem('dev-user-role') as UserRole;
    if (stored) {
      setCurrentRole(stored);
    }
  }

  return (
    <RoleContext.Provider value={{ currentRole, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
