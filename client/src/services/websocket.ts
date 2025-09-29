import { io, Socket } from 'socket.io-client';
import { useStore } from '../store';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect() {
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001';
    
    this.socket = io(wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      useStore.getState().setConnected(true);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      useStore.getState().setConnected(false);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      useStore.getState().setError('Connection error. Retrying...');
    });

    // Real-time data events
    this.socket.on('candidate:created', (data) => {
      useStore.getState().handleRealtimeUpdate('candidate:created', data);
    });

    this.socket.on('candidate:updated', (data) => {
      useStore.getState().handleRealtimeUpdate('candidate:updated', data);
    });

    this.socket.on('candidate:deleted', (data) => {
      useStore.getState().handleRealtimeUpdate('candidate:deleted', data);
    });

    this.socket.on('pipeline:moved', (data) => {
      useStore.getState().handleRealtimeUpdate('pipeline:moved', data);
    });

    this.socket.on('assessment:completed', (data) => {
      useStore.getState().handleRealtimeUpdate('assessment:completed', data);
    });

    this.socket.on('ai:processing', (data) => {
      useStore.getState().setSuccessMessage(`AI processing: ${data.status}`);
    });

    this.socket.on('bulk:progress', (data) => {
      useStore.getState().setSuccessMessage(
        `Bulk import progress: ${data.completed}/${data.total}`
      );
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected. Queuing event:', event);
      // Could implement a queue here
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const wsService = new WebSocketService();
