/**
 * GPS wrapper. Native Capacitor on device, `navigator.geolocation` on web.
 */

import { Geolocation } from '@capacitor/geolocation';
import { isNative } from './index';

export interface FixResult {
  lat: number;
  lng: number;
  accuracy: number;
}

export async function getCurrentPosition(): Promise<FixResult> {
  if (isNative()) {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  }
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('geolocation-unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
