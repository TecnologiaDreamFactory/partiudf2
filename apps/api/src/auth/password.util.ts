import { BadRequestException } from '@nestjs/common';

const NUMERIC_PASSWORD_REGEX = /^\d{4,8}$/;

export function validateNumericPassword(pw: string): void {
  if (!pw || typeof pw !== 'string') {
    throw new BadRequestException('Senha deve ter de 4 a 8 dígitos numéricos');
  }
  if (!NUMERIC_PASSWORD_REGEX.test(pw)) {
    throw new BadRequestException('Senha deve ter de 4 a 8 dígitos numéricos');
  }
}

export function isValidNumericPassword(pw: string): boolean {
  return typeof pw === 'string' && NUMERIC_PASSWORD_REGEX.test(pw);
}
