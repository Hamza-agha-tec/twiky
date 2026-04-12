import { io, Socket } from 'socket.io-client';
import { createClient } from '@/utils/supabase/client';

let socket: Socket | null = null;
let socketToken: string | null = null;

export async function getSocket(tokenOverride?: string): Promise<Socket> {
  const token = tokenOverride ?? await getAccessToken();

  if (socket && socketToken === token) {
    if (!socket.connected && !socket.active) {
      socket.connect();
    }
    return socket;
  }

  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
  }

  socketToken = token;

  socket = io(process.env.NEXT_PUBLIC_API_URL!, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
  });

  // Disconnect eagerly on tab/browser close so the server marks us offline immediately
  window.addEventListener('beforeunload', disconnectSocket);

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}
