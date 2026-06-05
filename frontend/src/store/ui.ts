import { create } from 'zustand';

interface UIState {
  showLaunchPopup: boolean;
  setShowLaunchPopup: (v: boolean) => void;
  notificationBadge: number;
  setNotificationBadge: (n: number) => void;
}

export const useUI = create<UIState>((set) => ({
  showLaunchPopup: false,
  setShowLaunchPopup: (showLaunchPopup) => set({ showLaunchPopup }),
  notificationBadge: 0,
  setNotificationBadge: (notificationBadge) => set({ notificationBadge }),
}));
