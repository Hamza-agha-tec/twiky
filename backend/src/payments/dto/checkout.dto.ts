import { IsString, IsOptional } from 'class-validator';

export class CreateCheckoutDto {
    @IsString()
    productId: string;

    @IsOptional()
    @IsString()
    redirectUrl?: string;
}
