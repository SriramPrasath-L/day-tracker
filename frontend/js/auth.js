// Talks to Cognito (the login service) directly over HTTPS and keeps the session on this device.
import { CONFIG } from './config.js';

const KEY = 'dt-session';
const base = { ClientId: CONFIG.clientId };
const readJwt = (jwt) => JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

async function cognito(target, body) {
  const r = await fetch(`https://cognito-idp.${CONFIG.region}.amazonaws.com/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'AWSCognitoIdentityProviderService.' + target },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(friendly(data));
  return data;
}

function friendly(d) {
  const type = (d.__type || '').split('#').pop();
  const map = {
    NotAuthorizedException: 'Wrong email or password.',
    UserNotFoundException: 'No account with that email.',
    UsernameExistsException: 'An account with that email already exists.',
    CodeMismatchException: 'That code is not right.',
    ExpiredCodeException: 'That code has expired. Ask for a new one.',
    InvalidPasswordException: 'Password too weak: use 10+ characters with upper, lower, number and symbol.',
    UserNotConfirmedException: 'Please confirm your email first.',
    LimitExceededException: 'Too many attempts. Try again in a while.',
    TooManyRequestsException: 'Too many attempts. Try again in a while.',
  };
  return map[type] || d.message || 'Something went wrong.';
}

export const signUp = (email, password) => cognito('SignUp', { ...base, Username: email, Password: password, UserAttributes: [{ Name: 'email', Value: email }] });
export const confirm = (email, code) => cognito('ConfirmSignUp', { ...base, Username: email, ConfirmationCode: code });
export const resend = (email) => cognito('ResendConfirmationCode', { ...base, Username: email });
export const forgot = (email) => cognito('ForgotPassword', { ...base, Username: email });
export const resetPassword = (email, code, password) => cognito('ConfirmForgotPassword', { ...base, Username: email, ConfirmationCode: code, Password: password });

function store(result, email, refreshToken) {
  const idToken = result.IdToken;
  localStorage.setItem(KEY, JSON.stringify({ idToken, refreshToken: refreshToken || result.RefreshToken, exp: readJwt(idToken).exp, email }));
}

export async function signIn(email, password) {
  const d = await cognito('InitiateAuth', { ...base, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: password } });
  store(d.AuthenticationResult, email);
}

export function session() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
export function signOut() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

// Returns a valid login token, renewing it quietly when it is about to expire.
export async function getToken() {
  const s = session();
  if (!s) throw new Error('Not signed in.');
  if (s.exp - 60 > Date.now() / 1000) return s.idToken;
  try {
    const d = await cognito('InitiateAuth', { ...base, AuthFlow: 'REFRESH_TOKEN_AUTH', AuthParameters: { REFRESH_TOKEN: s.refreshToken } });
    store(d.AuthenticationResult, s.email, s.refreshToken);
    return session().idToken;
  } catch {
    signOut();
    throw new Error('Session expired. Please sign in again.');
  }
}
