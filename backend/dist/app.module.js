"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_controller_1 = require("./auth/controllers/auth.controller");
const auth_service_1 = require("./auth/services/auth.service");
const users_module_1 = require("./users/users.module");
const supabase_module_1 = require("./supabase/supabase.module");
const contacts_module_1 = require("./contacts/contacts.module");
const messaging_module_1 = require("./messaging/messaging.module");
const passport_1 = require("@nestjs/passport");
const supabase_strategy_1 = require("./auth/strategies/supabase.strategy");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            supabase_module_1.SupabaseModule,
            passport_1.PassportModule,
            users_module_1.UsersModule,
            contacts_module_1.ContactsModule,
            messaging_module_1.MessagingModule,
        ],
        controllers: [app_controller_1.AppController, auth_controller_1.AuthController],
        providers: [app_service_1.AppService, auth_service_1.AuthService, supabase_strategy_1.SupabaseStrategy],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map