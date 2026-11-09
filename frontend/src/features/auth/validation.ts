/** Dieselben Regeln wie im Backend (Agent 3): Name 3–20 [a-zA-Z0-9_], Passwort ≥ 8. */
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const EMAIL_RE = /^\S+@\S+\.\S+$/;
export const MIN_PASSWORD = 8;

export function validateRegistration(v: {
  email: string;
  username: string;
  password: string;
  ageConfirmed: boolean;
}) {
  return {
    ageConfirmed: v.ageConfirmed ? null : 'auth.errors.age',
    email: EMAIL_RE.test(v.email.trim()) ? null : 'auth.errors.email',
    username: USERNAME_RE.test(v.username.trim()) ? null : 'auth.errors.username',
    password: v.password.length >= MIN_PASSWORD ? null : 'auth.errors.password',
  };
}
