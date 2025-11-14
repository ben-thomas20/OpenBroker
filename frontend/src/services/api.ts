import axios, { AxiosInstance } from 'axios';
import type { 
  LoginCredentials, 
  RegisterData, 
  AuthResponse, 
  Account, 
  Instrument, 
  Position, 
  Order,
  OrderState,
  Balance,
  VettingResult
} from '../types';

// Use proxy in development, direct URL in production
const API_BASE_URL = import.meta.env.DEV 
  ? '/api'  // Vite proxy will forward to the actual server
  : 'https://openbroker.boutiquesoftware.com';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
      },
      withCredentials: true, // This is required for cookies to be sent
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  clearToken() {
    localStorage.removeItem('auth_token');
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    await this.client.post('/login_ui', {
      email_address: credentials.email,
      password: credentials.password,
    });
    
    this.setToken('session');
    return {
      token: 'session',
      user: { id: 'user', email: credentials.email, name: '' },
    };
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    await this.client.post('/register_ui', {
      offer_code: data.offerCode,
      actor_name: data.name,
      email_address: data.email,
      password: data.password,
    });
    this.setToken('session');
    return {
      token: 'session',
      user: { id: 'user', email: data.email, name: data.name },
    };
  }

  async getAccounts(): Promise<Record<string, Account>> {
    try {
      const response = await this.client.get<Record<string, Account>>('/accounts');
      return response.data || {};
    } catch (error: any) {
      // If accounts endpoint fails, try to continue with empty accounts
      // The user might still be able to use the dashboard if they have account info from elsewhere
      return {};
    }
  }

  async getInstruments(): Promise<Record<string, Instrument>> {
    const response = await this.client.get<Record<string, Instrument>>('/instruments');
    return response.data || {};
  }

  async getPositions(accountKey: string): Promise<Record<number, Position>> {
    try {
      const response = await this.client.get<Record<number, Position>>(`/accounts/${accountKey}/positions`);
      return response.data || {};
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        return {};
      }
      throw error;
    }
  }

  async getBalance(accountKey: string): Promise<Balance | null> {
    try {
      const response = await this.client.get<Balance[]>(`/accounts/${accountKey}/balances`);
      return response.data && response.data.length > 0 ? response.data[0] : null;
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        return null;
      }
      throw error;
    }
  }

  async getOrders(accountKey: string): Promise<Record<string, OrderState>> {
    try {
      const response = await this.client.get<Record<string, OrderState>>(`/accounts/${accountKey}/orders`);
      return response.data || {};
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        return {};
      }
      throw error;
    }
  }

  async getOrder(accountKey: string, extOrderId: string): Promise<OrderState> {
    const response = await this.client.get<OrderState>(`/accounts/${accountKey}/orders/${extOrderId}`);
    return response.data;
  }

  async previewOrder(accountKey: string, order: Order): Promise<VettingResult> {
    const response = await this.client.post<VettingResult>(`/accounts/${accountKey}/previewOrder`, order);
    return response.data;
  }

  async submitOrder(accountKey: string, order: Order): Promise<OrderState> {
    const response = await this.client.post<OrderState>(`/accounts/${accountKey}/orders`, order);
    return response.data;
  }

  async cancelOrder(accountKey: string, extOrderId: string): Promise<OrderState> {
    const response = await this.client.delete<OrderState>(`/accounts/${accountKey}/orders/${extOrderId}`);
    return response.data;
  }
}

export const api = new ApiClient();
