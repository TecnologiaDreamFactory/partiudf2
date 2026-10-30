const NUMERIC_PASSWORD_REGEX = /^\d{4,8}$/;

export function generateNumericPassword(len = 8): string {
  const clamped = Math.min(8, Math.max(4, len));
  let result = '';
  for (let i = 0; i < clamped; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

export function isValidNumericPassword(pw: string): boolean {
  return typeof pw === 'string' && NUMERIC_PASSWORD_REGEX.test(pw);
}
