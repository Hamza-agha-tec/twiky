"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketAuthMiddleware = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const SocketAuthMiddleware = (supabaseUrl) => {
    const client = (0, jwks_rsa_1.default)({
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
        cache: true,
        rateLimit: true,
    });
    const getKey = (header, callback) => {
        client.getSigningKey(header.kid, (err, key) => {
            const signingKey = key.publicKey || key.rsaPublicKey;
            callback(null, signingKey);
        });
    };
    return (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }
            jwt.verify(token, getKey, {
                algorithms: ['ES256'],
                issuer: `${supabaseUrl}/auth/v1`,
                audience: 'authenticated',
            }, (err, decoded) => {
                if (err) {
                    return next(new Error(`Authentication error: ${err.message}`));
                }
                socket.data.user = { userId: decoded.sub, email: decoded.email };
                next();
            });
        }
        catch (error) {
            next(new Error('Authentication error'));
        }
    };
};
exports.SocketAuthMiddleware = SocketAuthMiddleware;
//# sourceMappingURL=ws-auth.middleware.js.map