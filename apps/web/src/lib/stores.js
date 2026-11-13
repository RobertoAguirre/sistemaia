import { writable } from 'svelte/store';

export const auth = writable({
  token: null,
  user: null,
  loaded: false,
});

const TOKEN_KEY = 'sistemaia_token';
const USER_KEY = 'sistemaia_user';

export function initAuth() {
  if (typeof localStorage === 'undefined') return;
  const token = localStorage.getItem(TOKEN_KEY);
  const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  auth.set({ token, user, loaded: true });
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  auth.set({ token, user, loaded: true });
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  auth.set({ token: null, user: null, loaded: true });
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
