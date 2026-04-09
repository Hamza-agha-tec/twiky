import { AuthService } from '../services/auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    authenticate(): string;
    getUser(): string;
    signout(): string;
}
