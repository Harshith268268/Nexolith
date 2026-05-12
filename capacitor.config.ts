import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.healthai.app',
  appName: 'HealthAI',
  webDir: 'dist',
  // The mobile app uses bundled dist/ assets.
  // The API URL is baked into the build via VITE_API_URL in .env.production
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  }
};

export default config;
