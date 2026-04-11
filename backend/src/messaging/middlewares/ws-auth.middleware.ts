import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

export const SocketAuthMiddleware = (supabaseUrl: string) => {
  const client = jwksRsa({
    jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
  });

  const getKey = (header: any, callback: any) => {
    client.getSigningKey(header.kid, (err, key: any) => {
      const signingKey = key.publicKey || key.rsaPublicKey;
      callback(null, signingKey);
    });
  };

  return (socket: Socket, next: (err?: Error) => void) => {
    try {
      // Get token from handshake auth or headers
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      jwt.verify(
        token,
        getKey,
        {
          algorithms: ['ES256'],
          issuer: `${supabaseUrl}/auth/v1`,
          audience: 'authenticated',
        },
        (err, decoded: any) => {
          if (err) {
            return next(new Error(`Authentication error: ${err.message}`));
          }
          // Attach user to socket data
          socket.data.user = { userId: decoded.sub, email: decoded.email };
          next();
        },
      );
    } catch (error) {
      next(new Error('Authentication error'));
    }
  };
};
