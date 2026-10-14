import { create } from 'zustand';
import { ApiClient } from '../storage/apiClient';
import type { ApiIdentity } from '../storage/apiClient';

// Plain http to a local or private address is only allowed in development builds.
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface ConnectionState {
  status: ConnectionStatus;
  baseUrl: string;
  api: ApiClient | null;
  /** Who the SERVER says this is (GET /auth/me). Never set from the app's own settings or from what the user picked. */
  identity: ApiIdentity | null;
  error: string;
  signInDev: (baseUrl: string, userId: string, role: 'patient' | 'doctor') => Promise<void>;
  connectWithToken: (baseUrl: string, token: string) => Promise<void>;
  disconnect: () => void;
}

// Every connection attempt gets a number; an answer that arrives after a newer attempt or a disconnect is dropped.
let generation = 0;

const message = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Could not reach the server. Saved data is retained.');

async function verify(baseUrl: string, token: string): Promise<{ api: ApiClient; identity: ApiIdentity }> {
  const api = new ApiClient(baseUrl, token, fetch, DEV);
  const identity = await api.identity();
  return { api, identity };
}

/** One server connection for the whole app. Kept in memory only: the token is never stored, and a restart signs out. */
export const useServer = create<ConnectionState>((set) => {
  const attempt = async (baseUrl: string, work: (current: number) => Promise<{ api: ApiClient; identity: ApiIdentity }>) => {
    const current = ++generation;
    set({ status: 'connecting', error: '', api: null, identity: null, baseUrl });
    try {
      const { api, identity } = await work(current);
      if (current !== generation) return;
      set({ status: 'connected', api, identity, baseUrl: api.baseUrl, error: '' });
    } catch (e) {
      if (current !== generation) return;
      set({ status: 'disconnected', api: null, identity: null, error: message(e) });
    }
  };
  return {
    status: 'disconnected', baseUrl: process.env.EXPO_PUBLIC_API_URL ?? '', api: null, identity: null, error: '',
    signInDev: (baseUrl, userId, role) => attempt(baseUrl.trim(), async () => {
      await ApiClient.health(baseUrl.trim(), fetch, DEV);
      const login = await ApiClient.devLogin(baseUrl.trim(), userId, role, fetch, DEV);
      return verify(baseUrl.trim(), login.token);
    }),
    connectWithToken: (baseUrl, token) => attempt(baseUrl.trim(), async () => {
      await ApiClient.health(baseUrl.trim(), fetch, DEV);
      return verify(baseUrl.trim(), token);
    }),
    disconnect: () => {
      generation++;
      set({ status: 'disconnected', api: null, identity: null, error: '' });
    },
  };
});
