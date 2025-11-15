import type { AccountUpdate, MarketData, MarketDepth, LastTrade } from '../types';

type WebSocketCallback = (data: AccountUpdate) => void;
type MarketDataCallback = (data: MarketData) => void;

class StompWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private callbacks: Map<string, WebSocketCallback[]> = new Map();
  private marketCallbacks: Map<string, MarketDataCallback[]> = new Map();
  private depthCallbacks: Map<string, ((data: MarketDepth) => void)[]> = new Map();
  private lastTradeCallbacks: Map<string, ((data: LastTrade) => void)[]> = new Map();
  private subscriptions: Map<string, number> = new Map();
  private subscriptionCounter = 0;
  private connected = false;
  private wsUrl: string;

  constructor() {
    // In development, we can't proxy WebSocket through Vite easily, so use direct connection
    // The WebSocket will still need proper CORS/credentials setup on the server
    this.wsUrl = import.meta.env.VITE_WS_URL || 'wss://openbroker.boutiquesoftware.com/ws';
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.connected) {
      return;
    }
    // Don't connect immediately - wait a bit for session to be established
    setTimeout(() => {
      this.connectInternal();
    }, 500);
  }

  private connectInternal() {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.connected = false;
        this.sendConnect();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = () => {
        // WebSocket errors are handled silently - WebSocket is optional for real-time updates
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.attemptReconnect();
      };
    } catch {
      // Connection error - will attempt to reconnect
      this.attemptReconnect();
    }
  }

  private sendConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const connectMsg = 'CONNECT\naccept-version:1.2,2.0\n\n\x00';
      this.ws.send(connectMsg);
    }
  }

  private handleMessage(data: string | Blob) {
    if (data instanceof Blob) {
      data.text().then(text => this.parseMessage(text));
    } else {
      this.parseMessage(data);
    }
  }

  private parseMessage(message: string) {
    // Handle STOMP frames
    if (message.startsWith('CONNECTED')) {
      this.connected = true;
      this.reconnectAttempts = 0;
      // Resubscribe to all previous subscriptions
      this.resubscribeAll();
      return;
    }

    if (message.startsWith('MESSAGE')) {
      this.handleStompMessage(message);
      return;
    }

    // Try to parse as JSON (fallback for non-STOMP messages)
    try {
      const json = JSON.parse(message);
      if (json.type === 'error') {
        // Error logged silently - WebSocket is optional for real-time updates
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }

  private handleStompMessage(message: string) {
    const lines = message.split('\n');
    let destination = '';
    let body = '';
    let inBody = false;

    for (const line of lines) {
      if (line.startsWith('destination:')) {
        destination = line.substring('destination:'.length).trim();
      } else if (line === '') {
        inBody = true;
        continue;
      } else if (inBody && line !== '\x00') {
        body += line;
      }
    }

    if (destination && body) {
      try {
        // Check if this is a market data destination
        if (destination.includes('/markets/') && destination.includes('/depth')) {
          const depth: MarketDepth = JSON.parse(body);
          this.notifyDepthCallbacks(destination, depth);
        } else if (destination.includes('/markets/') && destination.includes('/last_trade')) {
          const lastTrade: LastTrade = JSON.parse(body);
          this.notifyLastTradeCallbacks(destination, lastTrade);
        } else if (destination.startsWith('/market/')) {
          const marketData: MarketData = JSON.parse(body);
          this.notifyMarketCallbacks(destination, marketData);
        } else {
          const accountUpdate: AccountUpdate = JSON.parse(body);
          this.notifyCallbacks(destination, accountUpdate);
        }
      } catch (e) {
        // Invalid message format - ignore
      }
    }
  }

  subscribe(accountKey: string, callback: WebSocketCallback) {
    const destination = `/account/${accountKey}/updates`;
    
    if (!this.callbacks.has(destination)) {
      this.callbacks.set(destination, []);
    }
    this.callbacks.get(destination)!.push(callback);

    // Subscribe via STOMP if connected
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.subscribeToDestination(destination);
    }
  }

  private subscribeToDestination(destination: string) {
    if (this.subscriptions.has(destination)) {
      return; // Already subscribed
    }

    this.subscriptionCounter++;
    const subId = this.subscriptionCounter;
    this.subscriptions.set(destination, subId);

    const subscribeMsg = `SUBSCRIBE\nid:${subId}\ndestination:${destination}\nack:auto\n\n\x00`;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(subscribeMsg);
    }
  }

  private resubscribeAll() {
    for (const destination of this.callbacks.keys()) {
      this.subscribeToDestination(destination);
    }
    for (const destination of this.marketCallbacks.keys()) {
      this.subscribeToDestination(destination);
    }
    for (const destination of this.depthCallbacks.keys()) {
      this.subscribeToDestination(destination);
    }
    for (const destination of this.lastTradeCallbacks.keys()) {
      this.subscribeToDestination(destination);
    }
  }

  unsubscribe(accountKey: string, callback: WebSocketCallback) {
    const destination = `/account/${accountKey}/updates`;
    const callbacks = this.callbacks.get(destination);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      if (callbacks.length === 0) {
        this.callbacks.delete(destination);
        // Unsubscribe from STOMP
        const subId = this.subscriptions.get(destination);
        if (subId && this.ws?.readyState === WebSocket.OPEN) {
          const unsubscribeMsg = `UNSUBSCRIBE\nid:${subId}\n\n\x00`;
          this.ws.send(unsubscribeMsg);
          this.subscriptions.delete(destination);
        }
      }
    }
  }

  sendRequest(accountKey: string, scope: 'balance' | 'positions' | 'orders' | 'market') {
    if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    const destination = `/account/${accountKey}/updates`;
    const body = JSON.stringify({
      request: 'GET',
      scope: scope
    });

    const sendMsg = `SEND\ndestination:${destination}\ncontent-type:application/json\ncontent-length:${body.length}\n\n${body}\x00`;
    this.ws.send(sendMsg);
  }

  private notifyCallbacks(destination: string, data: AccountUpdate) {
    const callbacks = this.callbacks.get(destination);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  private notifyMarketCallbacks(destination: string, data: MarketData) {
    const callbacks = this.marketCallbacks.get(destination);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  subscribeToMarketData(instrumentKey: string, depthCallback: (data: MarketDepth) => void, lastTradeCallback: (data: LastTrade) => void) {
    const depthDestination = `/markets/${instrumentKey}/depth`;
    const lastTradeDestination = `/markets/${instrumentKey}/last_trade`;
    
    if (!this.depthCallbacks.has(depthDestination)) {
      this.depthCallbacks.set(depthDestination, []);
    }
    this.depthCallbacks.get(depthDestination)!.push(depthCallback);

    if (!this.lastTradeCallbacks.has(lastTradeDestination)) {
      this.lastTradeCallbacks.set(lastTradeDestination, []);
    }
    this.lastTradeCallbacks.get(lastTradeDestination)!.push(lastTradeCallback);

    // Subscribe via STOMP if connected
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.subscribeToDestination(depthDestination);
      this.subscribeToDestination(lastTradeDestination);
    }
  }

  unsubscribeFromMarketData(instrumentKey: string, depthCallback: (data: MarketDepth) => void, lastTradeCallback: (data: LastTrade) => void) {
    const depthDestination = `/markets/${instrumentKey}/depth`;
    const lastTradeDestination = `/markets/${instrumentKey}/last_trade`;
    
    const depthCallbacks = this.depthCallbacks.get(depthDestination);
    if (depthCallbacks) {
      const index = depthCallbacks.indexOf(depthCallback);
      if (index > -1) {
        depthCallbacks.splice(index, 1);
      }
      if (depthCallbacks.length === 0) {
        this.depthCallbacks.delete(depthDestination);
        const subId = this.subscriptions.get(depthDestination);
        if (subId && this.ws?.readyState === WebSocket.OPEN) {
          const unsubscribeMsg = `UNSUBSCRIBE\nid:${subId}\n\n\x00`;
          this.ws.send(unsubscribeMsg);
          this.subscriptions.delete(depthDestination);
        }
      }
    }

    const lastTradeCallbacks = this.lastTradeCallbacks.get(lastTradeDestination);
    if (lastTradeCallbacks) {
      const index = lastTradeCallbacks.indexOf(lastTradeCallback);
      if (index > -1) {
        lastTradeCallbacks.splice(index, 1);
      }
      if (lastTradeCallbacks.length === 0) {
        this.lastTradeCallbacks.delete(lastTradeDestination);
        const subId = this.subscriptions.get(lastTradeDestination);
        if (subId && this.ws?.readyState === WebSocket.OPEN) {
          const unsubscribeMsg = `UNSUBSCRIBE\nid:${subId}\n\n\x00`;
          this.ws.send(unsubscribeMsg);
          this.subscriptions.delete(lastTradeDestination);
        }
      }
    }
  }

  private notifyDepthCallbacks(destination: string, data: MarketDepth) {
    const callbacks = this.depthCallbacks.get(destination);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  private notifyLastTradeCallbacks(destination: string, data: LastTrade) {
    const callbacks = this.lastTradeCallbacks.get(destination);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      setTimeout(() => {
        this.connectInternal();
      }, delay);
    }
  }

  disconnect() {
    if (this.ws) {
      if (this.connected && this.ws.readyState === WebSocket.OPEN) {
        const disconnectMsg = 'DISCONNECT\n\n\x00';
        this.ws.send(disconnectMsg);
      }
      this.ws.close();
      this.ws = null;
    }
    this.callbacks.clear();
    this.marketCallbacks.clear();
    this.depthCallbacks.clear();
    this.lastTradeCallbacks.clear();
    this.subscriptions.clear();
    this.reconnectAttempts = 0;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new StompWebSocketClient();
