declare module 'claude-code' {
  interface PluginState {
    'dev-null': { isOpen: boolean; mode: '' | 'always' | 'manual'; message: string; reply: string }
  }
}