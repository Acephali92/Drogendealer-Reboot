import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser } from '@/api/types';

interface AuthState {
  user: AuthUser | null;
  /** Nur im Speicher – nicht persistiert. */
  accessToken: string | null;
  /**
   * Das Backend liefert den Refresh-Token im JSON-Body (kein httpOnly-Cookie),
   * daher wird er in localStorage gehalten. Sobald das Backend Cookies nutzt, entfällt das.
   */
  refreshToken: string | null;
  setSession: (s: { user?: AuthUser; accessToken: string; refreshToken: string }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ user, accessToken, refreshToken }) =>
        set((s) => ({ user: user ?? s.user, accessToken, refreshToken })),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'dd-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user, refreshToken: s.refreshToken }),
    },
  ),
);
