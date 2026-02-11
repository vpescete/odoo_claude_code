// IPC Channel types - will be expanded as features are implemented

export interface WindowAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  setTitleBarOverlay: (options: { color: string; symbolColor: string }) => void
  onMaximizeChange: (callback: (maximized: boolean) => void) => () => void
}
