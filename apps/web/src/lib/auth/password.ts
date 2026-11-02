/** Regra única de senha (telas e servidor): 6+ caracteres, com pelo menos uma letra e um número. */
export const PASSWORD_RULE = 'Mínimo de 6 caracteres, com letra e número';
const PASSWORD_MAX = 64;

export function isValidPassword(pw: string): boolean {
  return (
    typeof pw === 'string' &&
    pw.length >= 6 &&
    pw.length <= PASSWORD_MAX &&
    /\p{L}/u.test(pw) &&
    /\d/.test(pw)
  );
}

/** Senha provisória aleatória de 8 caracteres (sem 0/O/1/l, fáceis de confundir ao ditar). */
export function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let pw: string;
  do {
    pw = Array.from(crypto.getRandomValues(new Uint32Array(8)), (n) => chars[n % chars.length]).join('');
  } while (!isValidPassword(pw));
  return pw;
}
