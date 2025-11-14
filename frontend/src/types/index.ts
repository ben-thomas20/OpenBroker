export interface User {
  id: string;
  email: string;
  name: string;
}

export type InstrumentStatus = 'Active' | 'Inactive';
export type AssetClass = 'Equity' | 'Option' | 'Commodity' | 'Future' | 'Forward' | 'Swap' | 'Bond' | 'Cryto';
export type OrderStatus = 'Rejected' | 'Pending' | 'Open' | 'Filled' | 'PendingCancel' | 'Canceled' | 'Expired';
export type Privilege = 'Owner' | 'Read' | 'Submit' | 'Cancel' | 'Withdraw';

export interface Account {
  account_key: string;
  account_number: string;
  account_name: string;
  nickname: string;
  privileges: Privilege[];
}

export interface Instrument {
  instrument_key: string;
  status: InstrumentStatus;
  symbol: string;
  asset_class: AssetClass;
  exchange_code: string;
  description: string;
  expiration_time: number;
}

export interface OrderLeg {
  instrument_key: string;
  ratio: number;
}

export interface Order {
  create_time: number;
  order_number?: number;
  ext_order_id?: string;
  account_key?: string;
  price: number;
  quantity: number;
  legs: OrderLeg[];
}

export interface OrderState {
  update_time: number;
  order_status: OrderStatus;
  filled_quantity: number;
  order: Order;
  version_number: number;
  reject_reason?: string;
}

export interface Position {
  account_key: string;
  instrument_key: string;
  quantity: number;
  cost: number;
  version_number: number;
  closed_gain: number;
}

export interface Balance {
  account_key: string;
  cash: number;
  version_number: number;
}

export interface VettingResult {
  pass: boolean;
  reject_reason?: string;
}

export interface AccountUpdate {
  balance?: Balance;
  position?: Position;
  trade?: any;
  order_state?: OrderState;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  offerCode: string;
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

