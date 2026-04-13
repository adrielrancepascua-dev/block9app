import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.block9.app',
  appName: 'Block9',
  webDir: 'dist',
  server: {
    url: 'https://block9app.vercel.app',
    cleartext: true,
  },
};

export default config;
