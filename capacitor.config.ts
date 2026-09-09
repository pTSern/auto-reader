import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.voiceflow.reader',
  appName: 'VoiceFlow Studio',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
