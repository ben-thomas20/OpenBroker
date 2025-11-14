import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../services/api';
import type { Account, Instrument, Position, Order } from '../types';

interface DataContextType {
  accounts: Account[];
  instruments: Instrument[];
  portfolio: Position[];
  orders: Order[];
  selectedAccount: string | null;
  loading: boolean;
  setSelectedAccount: (accountId: string | null) => void;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [portfolio, setPortfolio] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [accountsData, instrumentsData, portfolioData, ordersData] = await Promise.all([
        api.getAccounts(),
        api.getInstruments(),
        api.getPortfolio(selectedAccount || undefined),
        api.getOrders(selectedAccount || undefined),
      ]);

      setAccounts(accountsData);
      setInstruments(instrumentsData);
      setPortfolio(portfolioData);
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return (
    <DataContext.Provider
      value={{
        accounts,
        instruments,
        portfolio,
        orders,
        selectedAccount,
        loading,
        setSelectedAccount,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
