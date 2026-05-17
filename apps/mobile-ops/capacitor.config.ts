import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.feerasta.zameen.ops',
  appName: 'Zameen Ops',
  webDir: 'www',
  server: {
    url: process.env.ZAMEEN_OPS_URL ?? 'https://ops.agri.feerasta.ai',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
    backgroundColor: '#0A0A0B',
  },
  android: {
    backgroundColor: '#0A0A0B',
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    LocalNotifications: { smallIcon: 'ic_stat_zameen', iconColor: '#5BE3FF' },
    Camera: { 'permissions.camera': 'usage' },
    Geolocation: { 'permissions.locationAlwaysAndWhenInUse': 'usage' },
  },
};

export default config;
