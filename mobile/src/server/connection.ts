import { create } from 'zustand';
import { ApiClient } from '../storage/apiClient';
import type { ApiIdentity } from '../storage/apiClient';
import { DEFAULT_API_URL, DEMO_ACCOUNTS } from './defaults';

// Plain http is only accepted for localhost and private network addresses (see checkBaseUrl), and only in development builds or in a
// demo build made with EXPO_PUBLIC_ALLOW_LOCAL_HTTP=1 (the demo APK, which talks to the team's laptop on the same Wi-Fi). Any other
// address must be https.
const DEV = (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.EXPO_PUBLIC_ALLOW_LOCAL_HTTP === '1';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface ConnectionState {
  status: ConnectionStatus;
  baseUrl: string;
  api: ApiClient | null;
  /** Who the SERVER says this is (GET /auth/me). Never set from the app's own settings or from what the user picked. */
  identity: ApiIdentity | null;
  error: string;
  /** The assessment a doctor is looking at (typed in, as the server has no list endpoint). */
  lookupId: string;
  setLookupId: (id: string) => void;
  /** Intakes uploaded from this phone in this run, newest first (the doctor list can show them). */
  recentIntakeIds: string[];
  rememberIntake: (id: string) => void;
  signInDev: (baseUrl: string, userId: string, role: 'patient' | 'doctor') => Promise<void>;
  /** One tap: sign in to the fixed demo account for that role, at the current address. */
  signInDemo: (role: 'patient' | 'doctor') => Promise<void>;
  setBaseUrl: (baseUrl: string) => void;
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
export const useServer = create<ConnectionState>((set, get) => {
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
    status: 'disconnected', baseUrl: DEFAULT_API_URL, api: null, identity: null, error: '', lookupId: '',
    setLookupId: (lookupId) => set({ lookupId }),
    recentIntakeIds: [],
    rememberIntake: (id) => set((st) => ({ recentIntakeIds: [id, ...st.recentIntakeIds.filter((x) => x !== id)].slice(0, 10) })),
    setBaseUrl: (baseUrl) => set({ baseUrl }),
    signInDev: (baseUrl, userId, role) => attempt(baseUrl.trim(), async () => {
      await ApiClient.health(baseUrl.trim(), fetch, DEV);
      const login = await ApiClient.devLogin(baseUrl.trim(), userId, role, fetch, DEV);
      return verify(baseUrl.trim(), login.token);
    }),
    signInDemo: (role) => get().signInDev(get().baseUrl, DEMO_ACCOUNTS[role], role),
    connectWithToken: (baseUrl, token) => attempt(baseUrl.trim(), async () => {
      await ApiClient.health(baseUrl.trim(), fetch, DEV);
      return verify(baseUrl.trim(), token);
    }),
    disconnect: () => {
      generation++;
      set({ status: 'disconnected', api: null, identity: null, error: '', lookupId: '', recentIntakeIds: [] });
    },
  };
});
