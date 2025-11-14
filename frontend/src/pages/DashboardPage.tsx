import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { BentoCard, BentoGrid } from '@/components/ui/bento-grid';
import { Button } from '@/components/ui/button';
import { 
  WalletIcon, 
  TrendingUpIcon, 
  FileTextIcon, 
  ListIcon,
  DollarSignIcon 
} from 'lucide-react';
import type { 
  Account, 
  Instrument, 
  Position, 
  OrderState, 
  Balance, 
  Order,
  AccountUpdate
} from '../types';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Data state
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [selectedAccountKey, setSelectedAccountKey] = useState<string>('');
  const [instruments, setInstruments] = useState<Record<string, Instrument>>({});
  const [positions, setPositions] = useState<Record<number, Position>>({});
  const [orders, setOrders] = useState<Record<string, OrderState>>({});
  const [balance, setBalance] = useState<Balance | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Order placement state
  const [orderInstrument, setOrderInstrument] = useState<string>('');
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [orderPrice, setOrderPrice] = useState<number>(0);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ pass: boolean; reject_reason?: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const loadAccountData = useCallback(async () => {
    if (!selectedAccountKey) return;
    
    try {
      const [positionsData, ordersData, balanceData] = await Promise.all([
        api.getPositions(selectedAccountKey),
        api.getOrders(selectedAccountKey),
        api.getBalance(selectedAccountKey)
      ]);
      
      setPositions(positionsData);
      setOrders(ordersData);
      setBalance(balanceData);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        setError('Session expired. Please log out and log back in.');
        logout();
        navigate('/login');
      } else {
        setError(`Failed to load account data: ${err.message || 'Unknown error'}`);
      }
    }
  }, [selectedAccountKey, logout, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Add a small delay to ensure session cookie is set after login
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const [accountsData, instrumentsData] = await Promise.all([
        api.getAccounts(),
        api.getInstruments()
      ]);
      
      setAccounts(accountsData);
      setInstruments(instrumentsData);
      
      // Select first account if available
      const accountKeys = Object.keys(accountsData);
      if (accountKeys.length > 0 && !selectedAccountKey) {
        setSelectedAccountKey(accountKeys[0]);
      }
      
      // Don't show error if accounts endpoint fails but we have instruments
      // The account might be selected from a previous session or WebSocket
      if (accountKeys.length === 0 && Object.keys(instrumentsData).length === 0) {
        setError('Unable to load data. Please check your authentication.');
      }
    } catch (err: any) {
      const status = err.response?.status;
      const statusText = err.response?.statusText;
      
      if (status === 403) {
        setError('Access forbidden. Please log out and log back in.');
      } else if (status === 500) {
        setError('Server error. Please try again later.');
      } else if (status === 401) {
        setError('Session expired. Please log out and log back in.');
        logout();
        navigate('/login');
      } else {
        setError(err.message || `Failed to load data: ${statusText || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load initial data after a short delay to ensure session is established
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    
    wsClient.connect();
    
    return () => {
      clearTimeout(timer);
      wsClient.disconnect();
    };
  }, []);

  // Subscribe to WebSocket updates when account is selected
  useEffect(() => {
    if (selectedAccountKey) {
      const callback = (update: AccountUpdate) => {
        if (update.balance) {
          setBalance(update.balance);
        }
        if (update.position) {
          setPositions(prev => {
            const newPositions = { ...prev };
            // Find position by instrument_key and update it
            const existingKey = Object.keys(newPositions).find(
              key => newPositions[parseInt(key)].instrument_key === update.position!.instrument_key
            );
            if (existingKey) {
              newPositions[parseInt(existingKey)] = update.position!;
            } else {
              // Add new position (we don't have position_id from update, so we'll need to reload)
              loadAccountData();
            }
            return newPositions;
          });
        }
        if (update.order_state) {
          setOrders(prev => {
            const newOrders = { ...prev };
            const extOrderId = update.order_state!.order.ext_order_id;
            if (extOrderId) {
              newOrders[extOrderId] = update.order_state!;
            }
            return newOrders;
          });
        }
      };

      wsClient.subscribe(selectedAccountKey, callback);
      
      // Request initial data via WebSocket
      wsClient.sendRequest(selectedAccountKey, 'balance');
      wsClient.sendRequest(selectedAccountKey, 'positions');
      wsClient.sendRequest(selectedAccountKey, 'orders');

      return () => {
        wsClient.unsubscribe(selectedAccountKey, callback);
      };
    }
  }, [selectedAccountKey, loadAccountData]);

  // Load data when account changes
  useEffect(() => {
    if (selectedAccountKey) {
      loadAccountData();
    }
  }, [selectedAccountKey, loadAccountData]);

  const handleLogout = () => {
    wsClient.disconnect();
    logout();
    navigate('/login');
  };

  const handlePreviewOrder = async () => {
    if (!selectedAccountKey || !orderInstrument || !orderQuantity) {
      alert('Please select an account, instrument, and quantity');
      return;
    }

    setPreviewing(true);
    setPreviewResult(null);
    
    try {
      const order: Order = {
        create_time: Date.now(),
        price: orderPrice || 0,
        quantity: orderQuantity,
        legs: [
          {
            instrument_key: orderInstrument,
            ratio: 1
          }
        ]
      };

      const result = await api.previewOrder(selectedAccountKey, order);
      setPreviewResult(result);
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Failed to preview order');
    } finally {
      setPreviewing(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAccountKey || !orderInstrument || !orderQuantity) {
      alert('Please select an account, instrument, and quantity');
      return;
    }

    if (previewResult && !previewResult.pass) {
      alert('Order validation failed. Please check the preview result.');
      return;
    }
    
    setPlacingOrder(true);
    try {
      const order: Order = {
        create_time: Date.now(),
        price: orderPrice || 0,
        quantity: orderQuantity,
        legs: [
          {
            instrument_key: orderInstrument,
            ratio: 1
          }
        ]
      };

      await api.submitOrder(selectedAccountKey, order);
      await loadAccountData();
      setOrderQuantity(1);
      setOrderPrice(0);
      setOrderInstrument('');
      setPreviewResult(null);
      alert('Order placed successfully');
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Failed to place order');
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleCancelOrder = async (extOrderId: string) => {
    if (!selectedAccountKey || !extOrderId) return;
    
    if (!confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      await api.cancelOrder(selectedAccountKey, extOrderId);
      await loadAccountData();
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Failed to cancel order');
    }
  };

  const isOrderCancelable = (orderStatus: string) => {
    return orderStatus === 'Pending' || orderStatus === 'Open';
  };

  const accountList = Object.values(accounts);
  const instrumentList = Object.values(instruments);
  const positionList = Object.values(positions).filter(p => p.quantity !== 0 && 
    p.instrument_key !== '-cash-' && 
    p.instrument_key !== '-sub-totals-' && 
    p.instrument_key !== '-totals-');
  const orderList = Object.values(orders);

  // If accounts endpoint failed but we have positions/orders, try to extract account key
  useEffect(() => {
    if (accountList.length === 0 && selectedAccountKey) {
      // Account is already selected, likely from WebSocket or previous session
      // This is fine, continue working
      return;
    }
    
    // Try to get account from positions if accounts endpoint failed
    if (accountList.length === 0 && positionList.length > 0) {
      const accountFromPosition = positionList[0].account_key;
      if (accountFromPosition && !selectedAccountKey) {
        setSelectedAccountKey(accountFromPosition);
      }
    }
    
    // Try to get account from orders if accounts endpoint failed
    if (accountList.length === 0 && orderList.length > 0) {
      const accountFromOrder = orderList[0].order.account_key;
      if (accountFromOrder && !selectedAccountKey) {
        setSelectedAccountKey(accountFromOrder);
      }
    }
  }, [accountList.length, positionList, orderList, selectedAccountKey]);

  if (loading && accountList.length === 0 && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 bg-black">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2 text-white">Loading dashboard data...</div>
          <div className="text-sm text-gray-300/80 mt-4">
            Please wait while we fetch your accounts and instruments.
          </div>
          <div className="text-xs text-gray-400 mt-2">
            This may take a few seconds if you just logged in.
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no accounts and not loading
  if (!loading && accountList.length === 0 && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 bg-black">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">No Accounts Found</h2>
          <p className="text-gray-300/80 mb-6">
            You don't have any accounts associated with your account.
          </p>
          <Button 
            onClick={() => loadData()}
            className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-sm"
          >
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'Creato Display', sans-serif" }}>OpenBroker Trading Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-300">Welcome, {user?.email}</span>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
          >
            Logout
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/50 bg-red-500/10 backdrop-blur-sm p-4 text-red-300">
          <strong>Error:</strong> {error}
          <div className="mt-3 text-sm">
            <p className="font-semibold">Important: If you just restarted the dev server with the proxy, you need to:</p>
            <ol className="ml-5 mt-2 list-decimal">
              <li><strong>Log out</strong> (to clear any old session)</li>
              <li><strong>Log back in</strong> (this will set cookies through the proxy)</li>
              <li>Then the dashboard should work</li>
            </ol>
            <p className="mt-2">The proxy makes requests appear same-origin, which allows cookies to work properly.</p>
          </div>
          <div className="mt-4 flex gap-2">
            <Button 
              variant="destructive"
              onClick={() => {
                setError(null);
                loadData();
              }}
              className="bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30 backdrop-blur-sm"
            >
              Retry
            </Button>
            <Button 
              variant="secondary"
              onClick={handleLogout}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
            >
              Logout and Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Bento Grid Layout */}
      <BentoGrid className="lg:grid-rows-4">
        {/* Account & Balance Card */}
        <BentoCard
          name="Account & Balance"
          className="lg:col-span-1 lg:row-span-1"
          Icon={WalletIcon}
          description={selectedAccountKey ? `Account: ${selectedAccountKey.substring(0, 8)}...` : "Select an account to view balance"}
          href=""
          cta=""
        >
          <div className="flex h-full flex-col">
            <div className="mb-4 flex items-center gap-3">
              <WalletIcon className="h-8 w-8 text-white" />
              <h3 className="text-xl font-semibold text-white">Account & Balance</h3>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Select Account:</label>
                <select 
                  value={selectedAccountKey} 
                  onChange={(e) => setSelectedAccountKey(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-black/40 backdrop-blur-sm px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                >
                  <option value="">Select Account</option>
                  {accountList.map((account) => (
                    <option key={account.account_key} value={account.account_key} className="bg-black text-white">
                      {account.nickname || account.account_name} ({account.account_key.substring(0, 8)}...)
                    </option>
                  ))}
                  {accountList.length === 0 && selectedAccountKey && (
                    <option value={selectedAccountKey} disabled className="bg-black text-white">
                      {selectedAccountKey.substring(0, 8)}... (loaded from session)
                    </option>
                  )}
                </select>
              </div>
              {selectedAccountKey && balance && (
                <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
                  <div className="text-sm text-gray-300/80">Available Balance</div>
                  <div className="text-2xl font-bold text-white">
                    ${balance.cash.toFixed(2)}
                  </div>
                </div>
              )}
              {accountList.length === 0 && selectedAccountKey && (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/50 backdrop-blur-sm p-3 text-sm text-yellow-300">
                  <strong>Note:</strong> Account list unavailable, but using account from session
                </div>
              )}
            </div>
          </div>
        </BentoCard>

        {/* Order Placement Card */}
        {selectedAccountKey && (
          <BentoCard
            name="Place Order"
            className="lg:col-span-2 lg:row-span-1"
            Icon={TrendingUpIcon}
            description="Submit new buy or sell orders"
            href=""
            cta=""
          >
            <div className="flex h-full flex-col">
              <div className="mb-4 flex items-center gap-3">
                <TrendingUpIcon className="h-8 w-8 text-white" />
                <h3 className="text-xl font-semibold text-white">Place Order</h3>
              </div>
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">Instrument:</label>
                    <select 
                      value={orderInstrument} 
                      onChange={(e) => setOrderInstrument(e.target.value)}
                      className="w-full rounded-lg border border-white/20 bg-black/40 backdrop-blur-sm px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                    >
                      <option value="" className="bg-black text-white">Select Instrument</option>
                      {instrumentList.map((inst) => (
                        <option key={inst.instrument_key} value={inst.instrument_key} className="bg-black text-white">
                          {inst.symbol} - {inst.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">Quantity:</label>
                    <input
                      type="number"
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
                      min="1"
                      className="w-full rounded-lg border border-white/20 bg-black/40 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">Price (0 for market):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(parseFloat(e.target.value) || 0)}
                      min="0"
                      className="w-full rounded-lg border border-white/20 bg-black/40 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handlePreviewOrder} 
                    disabled={previewing || !orderInstrument || !orderQuantity}
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                  >
                    {previewing ? 'Previewing...' : 'Preview Order'}
                  </Button>
                  <Button 
                    onClick={handlePlaceOrder} 
                    disabled={placingOrder || !orderInstrument || !orderQuantity}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-sm"
                  >
                    {placingOrder ? 'Submitting...' : 'Submit Order'}
                  </Button>
                </div>
                {previewResult && (
                  <div className={`rounded-lg border backdrop-blur-sm p-3 text-sm ${
                    previewResult.pass 
                      ? 'bg-green-500/10 border-green-500/50 text-green-300' 
                      : 'bg-red-500/10 border-red-500/50 text-red-300'
                  }`}>
                    {previewResult.pass ? (
                      <strong>✓ Order validation passed</strong>
                    ) : (
                      <strong>✗ Order validation failed: {previewResult.reject_reason || 'Unknown error'}</strong>
                    )}
                  </div>
                )}
              </div>
            </div>
          </BentoCard>
        )}

        {/* Positions Card */}
        {selectedAccountKey && (
          <BentoCard
            name="Positions"
            className="lg:col-span-1 lg:row-span-2"
            Icon={DollarSignIcon}
            description={`${positionList.length} active positions`}
            href=""
            cta=""
          >
            <div className="flex h-full flex-col">
              <div className="mb-4 flex items-center gap-3">
                <DollarSignIcon className="h-8 w-8 text-white" />
                <h3 className="text-xl font-semibold text-white">Positions</h3>
              </div>
              <div className="flex-1 overflow-auto">
                {positionList.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    No positions
                  </div>
                ) : (
                  <div className="space-y-2">
                    {positionList.map((position, idx) => (
                      <div key={idx} className="rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-white">
                            {instruments[position.instrument_key]?.symbol || position.instrument_key}
                          </div>
                          <div className="text-sm text-gray-300">
                            Qty: {position.quantity}
                          </div>
                        </div>
                        <div className="mt-2 flex justify-between text-sm">
                          <span className="text-gray-300/80">Cost: ${position.cost.toFixed(2)}</span>
                          <span className={`font-medium ${
                            position.closed_gain >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            Gain: ${position.closed_gain.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </BentoCard>
        )}

        {/* Orders Card */}
        {selectedAccountKey && (
          <BentoCard
            name="Orders"
            className="lg:col-span-2 lg:row-span-2"
            Icon={FileTextIcon}
            description={`${orderList.length} active orders`}
            href=""
            cta=""
          >
            <div className="flex h-full flex-col">
              <div className="mb-4 flex items-center gap-3">
                <FileTextIcon className="h-8 w-8 text-white" />
                <h3 className="text-xl font-semibold text-white">Orders</h3>
              </div>
              <div className="flex-1 overflow-auto">
                {orderList.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    No orders
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-300">Order ID</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-300">Instrument</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-300">Qty</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-300">Price</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-300">Filled</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-300">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderList.map((orderState) => {
                          const instrumentKey = orderState.order.legs[0]?.instrument_key || '';
                          const instrument = instruments[instrumentKey];
                          return (
                            <tr key={orderState.order.ext_order_id || orderState.order.order_number} className="border-b border-white/5 hover:bg-white/5">
                              <td className="px-3 py-2 font-mono text-xs text-white">
                                {orderState.order.ext_order_id?.substring(0, 8) || orderState.order.order_number || 'N/A'}
                              </td>
                              <td className="px-3 py-2 text-white">{instrument?.symbol || instrumentKey}</td>
                              <td className="px-3 py-2 text-right text-white">{orderState.order.quantity}</td>
                              <td className="px-3 py-2 text-right text-white">
                                {orderState.order.price > 0 ? `$${orderState.order.price.toFixed(2)}` : 'Market'}
                              </td>
                              <td className="px-3 py-2 text-right text-white">{orderState.filled_quantity}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                  orderState.order_status === 'Filled' ? 'bg-green-500/20 text-green-300 border border-green-500/50' :
                                  orderState.order_status === 'Open' || orderState.order_status === 'Pending' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50' :
                                  orderState.order_status === 'Rejected' ? 'bg-red-500/20 text-red-300 border border-red-500/50' :
                                  'bg-white/10 text-gray-300 border border-white/20'
                                }`}>
                                  {orderState.order_status}
                                </span>
                                {orderState.reject_reason && (
                                  <div className="mt-1 text-xs text-red-300">
                                    {orderState.reject_reason}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {isOrderCancelable(orderState.order_status) && orderState.order.ext_order_id && (
                                  <Button 
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleCancelOrder(orderState.order.ext_order_id!)}
                                    className="bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30 backdrop-blur-sm"
                                  >
                                    Cancel
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </BentoCard>
        )}

        {/* Instruments Card */}
        <BentoCard
          name="Available Instruments"
          className="lg:col-span-3 lg:row-span-1"
          Icon={ListIcon}
          description={`${instrumentList.length} instruments available`}
          href=""
          cta=""
        >
            <div className="flex h-full flex-col">
              <div className="mb-4 flex items-center gap-3">
                <ListIcon className="h-8 w-8 text-white" />
                <h3 className="text-xl font-semibold text-white">Available Instruments</h3>
              </div>
              <div className="flex-1 overflow-auto">
                {instrumentList.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    No instruments available
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-300">Symbol</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-300">Description</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-300">Asset Class</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-300">Exchange</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-300">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {instrumentList.map((instrument) => (
                          <tr key={instrument.instrument_key} className="border-b border-white/5 hover:bg-white/5">
                            <td className="px-3 py-2 font-semibold text-white">{instrument.symbol}</td>
                            <td className="px-3 py-2 text-gray-300">{instrument.description}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex rounded-full bg-white/10 border border-white/20 px-2 py-1 text-xs text-white">
                                {instrument.asset_class}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-300">{instrument.exchange_code}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                instrument.status === 'Active' 
                                  ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                                  : 'bg-white/10 text-gray-300 border border-white/20'
                              }`}>
                                {instrument.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
