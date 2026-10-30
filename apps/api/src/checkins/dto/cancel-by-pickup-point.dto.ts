import { IsNotEmpty, IsString } from 'class-validator';

export class CancelByPickupPointDto {
  @IsString()
  @IsNotEmpty({ message: 'tripId é obrigatório' })
  tripId!: string;

  @IsString()
  @IsNotEmpty({ message: 'pickupPointCode é obrigatório' })
  pickupPointCode!: string;
}
