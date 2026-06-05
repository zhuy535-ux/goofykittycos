import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Organization, User } from '../types';
import { api, setAuthToken } from '../api/client';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  timezone: string;

  signin: (emailOrUsername: string, password: string) => Promise<void>;
  signup: (args: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
    mode: 'create_org' | 'join_org';
    orgName?: string;
    invitationCode?: string;
  }) => Promise<void>;
  hydrate: () => Promise<void>;

  logout: () => void;
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;
  setTimezone: (tz: string) => void;
  setOrganization: (org: Organization | null) => void;
}

const deviceTz =
  typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    : 'UTC';

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      token: null,
      timezone: deviceTz,

      signin: async (emailOrUsername, password) => {
        const { user, organization, token } = await api.post<{
          user: User; organization: Organization | null; token: string;
        }>('/auth/signin', { emailOrUsername, password, timezone: get().timezone });
        setAuthToken(token);
        set({ user, organization, token });
      },

      signup: async (args) => {
        const { user, organization, token } = await api.post<{
          user: User; organization: Organization | null; token: string;
        }>('/auth/signup', { ...args, timezone: get().timezone });
        setAuthToken(token);
        set({ user, organization, token });
      },

      hydrate: async () => {
        const { token } = get();
        if (!token) return;
        setAuthToken(token);
        try {
          const { user, organization } = await api.get<{
            user: User; organization: Organization | null;
          }>('/auth/me');
          set({ user, organization });
        } catch {
          setAuthToken(null);
          set({ user: null, organization: null, token: null });
        }
      },

      logout: () => {
        setAuthToken(null);
        set({ user: null, organization: null, token: null });
      },

      refresh: async () => {
        const u = get().user;
        if (!u) return;
        try {
          const { user, organization } = await api.get<{
            user: User; organization: Organization | null;
          }>('/auth/me');
          set({ user, organization });
        } catch {
          /* App-level guard handles 401 */
        }
      },

      updateProfile: async (patch) => {
        const u = get().user;
        if (!u) return;
        const updated = await api.patch<User>(`/users/${u.id}`, patch);
        set({ user: updated });
      },

      setTimezone: (tz) => set({ timezone: tz }),
      setOrganization: (organization) => set({ organization }),
    }),
    {
      name: 'entj-workspace-auth',
      partialize: (s) => ({
        user: s.user, organization: s.organization, token: s.token, timezone: s.timezone,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthToken(state.token);
      },
    }
  )
);
