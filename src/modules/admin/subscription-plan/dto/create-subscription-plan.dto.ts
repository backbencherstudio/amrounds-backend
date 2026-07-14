import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
} from 'class-validator';

// Define the enum manually if it's not exported by your Prisma setup easily
export enum PlanType {
    MONTHLY = 'MONTHLY',
    PAY_AS_YOU_GO = 'PAY_AS_YOU_GO',
}

export class CreateSubscriptionPlanDto {
    @ApiPropertyOptional({
        example: false,
        description: 'Whether the plan is popular',
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    is_popular?: boolean;




    @ApiProperty({
        example: 'Basic Plan',
        description: 'The name of the subscription plan',
    })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({
        enum: PlanType,
        example: PlanType.MONTHLY,
        description: 'The type of the plan',
        default: PlanType.MONTHLY,
    })
    @IsEnum(PlanType)
    @IsOptional()
    type?: PlanType;

    @ApiProperty({
        example: 29.99,
        description: 'The price of the plan',
    })
    @IsNumber()
    @IsNotEmpty()
    price: number;

    @ApiPropertyOptional({
        example: 'monthly',
        description: 'Billing period of the plan',
        default: 'monthly',
    })
    @IsString()
    @IsOptional()
    billing_period?: string;

    @ApiPropertyOptional({
        example: 100,
        description: 'Credits provided by the plan',
        default: 0,
    })
    @IsNumber()
    @IsOptional()
    credits?: number;

    @ApiPropertyOptional({
        type: [String],
        example: ['Feature 1', 'Feature 2'],
        description: 'List of benefits included in the plan',
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    benefits?: string[];
}
