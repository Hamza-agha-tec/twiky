import { IsString, IsOptional } from 'class-validator';

export class CreateCheckoutDto {
    @IsString()
    planId: string;

    @IsOptional()
    @IsString()
    redirectUrl?: string;
}
