/**
 * Camera wrapper. Uses Capacitor's native picker when available, falls back
 * to a web `<input capture>` element so the same call works in the browser.
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNative } from './index';

export interface PhotoResult {
  dataUrl: string;
}

export interface TakePhotoOptions {
  quality?: number;
}

export async function takePhoto(opts: TakePhotoOptions = {}): Promise<PhotoResult> {
  const quality = opts.quality ?? 80;
  if (isNative()) {
    const photo = await Camera.getPhoto({
      quality,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      saveToGallery: false,
      correctOrientation: true,
    });
    return { dataUrl: photo.dataUrl ?? '' };
  }
  return webFallback();
}

function webFallback(): Promise<PhotoResult> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('no-file-selected'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: String(reader.result ?? '') });
      reader.onerror = () => reject(reader.error ?? new Error('read-failed'));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
