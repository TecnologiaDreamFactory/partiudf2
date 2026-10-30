import { IsNotEmpty, IsString } from 'class-validator';

export class CancelCheckinDto {
  @IsString()
  @IsNotEmpty({ message: 'tripId é obrigatório' })
  tripId!: string;
}
