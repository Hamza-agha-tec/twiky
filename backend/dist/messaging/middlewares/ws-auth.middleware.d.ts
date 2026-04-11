import { Socket } from 'socket.io';
export declare const SocketAuthMiddleware: (supabaseUrl: string) => (socket: Socket, next: (err?: Error) => void) => void;
