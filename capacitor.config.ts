import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.metodotab.app',
  appName: 'Método TAB',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
