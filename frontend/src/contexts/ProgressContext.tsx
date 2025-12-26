import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ProgressItem {
  id: string;
  type: 'restore' | 'backup' | 'validation';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  title: string;
  description?: string;
  progress?: number;
  startTime: Date;
  endTime?: Date;
  logs: string[];
  details?: {
    rulesProcessed?: number;
    totalRules?: number;
    nsgsCreated?: number;
    errors?: string[];
  };
}

interface ProgressContextType {
  progressItems: ProgressItem[];
  isProgressSidebarOpen: boolean;
  addProgressItem: (item: Omit<ProgressItem, 'id' | 'startTime' | 'logs'>) => string;
  updateProgressItem: (id: string, updates: Partial<ProgressItem>) => void;
  addLogToItem: (id: string, log: string) => void;
  removeProgressItem: (id: string) => void;
  openProgressSidebar: () => void;
  closeProgressSidebar: () => void;
  toggleProgressSidebar: () => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

interface ProgressProviderProps {
  children: ReactNode;
}

export const ProgressProvider: React.FC<ProgressProviderProps> = ({ children }) => {
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [isProgressSidebarOpen, setIsProgressSidebarOpen] = useState(false);

  const addProgressItem = useCallback((item: Omit<ProgressItem, 'id' | 'startTime' | 'logs'>) => {
    const id = `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newItem: ProgressItem = {
      ...item,
      id,
      startTime: new Date(),
      logs: []
    };
    
    setProgressItems(prev => [newItem, ...prev]);
    setIsProgressSidebarOpen(true); // Auto-open sidebar when new item is added
    
    return id;
  }, []);

  const updateProgressItem = useCallback((id: string, updates: Partial<ProgressItem>) => {
    setProgressItems(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, ...updates, endTime: updates.status === 'completed' || updates.status === 'failed' ? new Date() : item.endTime }
          : item
      )
    );
  }, []);

  const addLogToItem = useCallback((id: string, log: string) => {
    setProgressItems(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, logs: [...item.logs, `[${new Date().toLocaleTimeString()}] ${log}`] }
          : item
      )
    );
  }, []);

  const removeProgressItem = useCallback((id: string) => {
    setProgressItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const openProgressSidebar = useCallback(() => {
    setIsProgressSidebarOpen(true);
  }, []);

  const closeProgressSidebar = useCallback(() => {
    setIsProgressSidebarOpen(false);
  }, []);

  const toggleProgressSidebar = useCallback(() => {
    setIsProgressSidebarOpen(prev => !prev);
  }, []);

  const value: ProgressContextType = {
    progressItems,
    isProgressSidebarOpen,
    addProgressItem,
    updateProgressItem,
    addLogToItem,
    removeProgressItem,
    openProgressSidebar,
    closeProgressSidebar,
    toggleProgressSidebar
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};

export default ProgressContext;