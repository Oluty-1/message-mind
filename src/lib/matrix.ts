import { createClient, MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';

export interface MessageMindConfig {
  homeserverUrl: string;
  userId: string;
  accessToken: string;
}

export class MessageMindMatrix {
  private client: MatrixClient;
  private isStarted = false;

  constructor(config: MessageMindConfig) {
    this.client = createClient({
      baseUrl: config.homeserverUrl,
      userId: config.userId,
      accessToken: config.accessToken,
    });
  }

  async start(): Promise<void> {
    if (this.isStarted) return;
    
    try {
      await this.client.startClient({ initialSyncLimit: 10 });
      this.isStarted = true;
      console.log('MessageMind Matrix client started');
    } catch (error) {
      console.error('Failed to start Matrix client:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    
    this.client.stopClient();
    this.isStarted = false;
    console.log('MessageMind Matrix client stopped');
  }

  // Get all rooms (including WhatsApp bridged rooms)
  getRooms(): Room[] {
    return this.client.getRooms();
  }

  // Get WhatsApp rooms specifically
  getWhatsAppRooms(): Room[] {
    return this.client.getRooms().filter(room => {
      const name = room.name || '';
      const topic = room.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic || '';
      const roomId = room.roomId || '';
      
      // WhatsApp bridge typically adds identifiers to room names/topics
      return name.toLowerCase().includes('whatsapp') || 
             topic.toLowerCase().includes('whatsapp') || 
             roomId.toLowerCase().includes('whatsapp') ||
             name.includes('(WA)') || // Common WhatsApp bridge naming
             name.includes('WA ') || // Another common pattern
             name.includes('WhatsApp');
    });
  }

  // Get recent messages from a room
  getRecentMessages(roomId: string, limit: number = 50): MatrixEvent[] {
    const room = this.client.getRoom(roomId);
    if (!room) return [];
    
    return room.timeline
      .filter(event => event.getType() === 'm.room.message')
      .slice(-limit);
  }

  // Send a message to a room
  async sendMessage(roomId: string, text: string): Promise<void> {
    try {
      await this.client.sendTextMessage(roomId, text);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  // Listen for new messages
  onNewMessage(callback: (event: MatrixEvent) => void): void {
    this.client.on('Room.timeline', (event, room, toStartOfTimeline) => {
      if (toStartOfTimeline || event.getType() !== 'm.room.message') return;
      callback(event);
    });
  }

  // Get user info
  getUserId(): string {
    return this.client.getUserId() || '';
  }

  // Check if client is ready
  isReady(): boolean {
    return this.isStarted && this.client.isInitialSyncComplete();
  }

  // Get raw client for advanced operations
  getClient(): MatrixClient {
    return this.client;
  }
}

// Utility functions for message processing
export const extractMessageContent = (event: MatrixEvent): string => {
  const content = event.getContent();
  return content.body || '';
};

export const getMessageSender = (event: MatrixEvent): string => {
  return event.getSender() || '';
};

export const getMessageTimestamp = (event: MatrixEvent): Date => {
  return new Date(event.getTs());
};

export const isWhatsAppMessage = (event: MatrixEvent): boolean => {
  const sender = getMessageSender(event);
  const room = event.event.room_id || '';
  return sender.includes('whatsapp_') || 
         sender.includes('@whatsappbot') ||
         room.includes('whatsapp') ||
         sender.includes('_wa_');
};