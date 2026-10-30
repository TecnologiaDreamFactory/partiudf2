import { IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateCheckinDto {
  @IsString()
  tripId!: string;

  @IsString()
  pickupPointCode!: string;

  @IsNumber()
  @Min(-90, { message: 'userLat deve ser entre -90 e 90' })
  @Max(90, { message: 'userLat deve ser entre -90 e 90' })
  userLat!: number;

  @IsNumber()
  @Min(-180, { message: 'userLng deve ser entre -180 e 180' })
  @Max(180, { message: 'userLng deve ser entre -180 e 180' })
  userLng!: number;
}
