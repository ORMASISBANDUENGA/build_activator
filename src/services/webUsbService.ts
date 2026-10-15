import { DeviceInfo } from '../types';

export const ANDROID_USB_VENDORS = [
  { id: 0x18d1, name: 'Google / Android' },
  { id: 0x04e8, name: 'Samsung' },
  { id: 0x2717, name: 'Xiaomi / Redmi / POCO' },
  { id: 0x12d1, name: 'Huawei / Honor' },
  { id: 0x22d9, name: 'Oppo / Realme' },
  { id: 0x2a70, name: 'OnePlus / Nothing' },
  { id: 0x2d95, name: 'Vivo / iQOO' },
  { id: 0x0fce, name: 'Sony' },
  { id: 0x22b8, name: 'Motorola' },
  { id: 0x17ef, name: 'Lenovo' },
  { id: 0x19d2, name: 'ZTE / Nubia' },
  { id: 0x1004, name: 'LG' },
  { id: 0x0bb4, name: 'HTC' },
  { id: 0x0b05, name: 'Asus / ROG' },
  { id: 0x05c6, name: 'Qualcomm' },
  { id: 0x0e8d, name: 'MediaTek' },
  { id: 0x2e04, name: 'Nokia / HMD' },
  { id: 0x1782, name: 'Spreadtrum / Unisoc' },
  { id: 0x291a, name: 'Tecno / Infinix / Itel' },
  { id: 0x1bbb, name: 'TCL / Alcatel' },
  { id: 0x2970, name: 'Fairphone' },
  { id: 0x1949, name: 'Amazon' },
  { id: 0x2a45, name: 'Meizu' },
  { id: 0x04dd, name: 'Sharp' }
];

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

export async function requestAndroidUsbDevice(): Promise<DeviceInfo | null> {
  if (!isWebUsbSupported()) {
    throw new Error("L'API WebUSB n'est pas supportée par ce navigateur. Utilisez Google Chrome, Edge, Brave ou Opera.");
  }

  const filters = ANDROID_USB_VENDORS.map((v) => ({ vendorId: v.id }));

  try {
    const usbDevice = await (navigator as any).usb.requestDevice({
      filters,
    });

    if (!usbDevice) return null;

    const vendorMatch = ANDROID_USB_VENDORS.find((v) => v.id === usbDevice.vendorId);
    const brand = usbDevice.manufacturerName || (vendorMatch ? vendorMatch.name.split('/')[0].trim() : 'Android');
    const model = usbDevice.productName || 'Téléphone USB';
    const serial = usbDevice.serialNumber || `USB-${usbDevice.vendorId.toString(16).padStart(4, '0')}-${usbDevice.productId.toString(16).padStart(4, '0')}`;

    return {
      serial,
      brand,
      model,
      androidVersion: 'Détecté via USB',
      sdk: '34',
      usbMode: 'Connecté (USB Data)',
      devModeEnabled: false,
      adbEnabled: false,
      isSimulated: false,
      isWebUsb: true,
      vendorId: usbDevice.vendorId,
      productId: usbDevice.productId,
    };
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      return null;
    }
    throw err;
  }
}

export async function getConnectedUsbDevices(): Promise<DeviceInfo[]> {
  if (!isWebUsbSupported()) return [];
  try {
    const devices = await (navigator as any).usb.getDevices();
    return devices.map((d: any) => {
      const vendorMatch = ANDROID_USB_VENDORS.find((v) => v.id === d.vendorId);
      return {
        serial: d.serialNumber || `USB-${d.vendorId.toString(16)}-${d.productId.toString(16)}`,
        brand: d.manufacturerName || (vendorMatch ? vendorMatch.name.split('/')[0].trim() : 'Android'),
        model: d.productName || 'Appareil USB',
        androidVersion: 'USB Connecté',
        sdk: '34',
        usbMode: 'Connecté',
        devModeEnabled: false,
        adbEnabled: false,
        isSimulated: false,
        isWebUsb: true,
        vendorId: d.vendorId,
        productId: d.productId,
      };
    });
  } catch (e) {
    return [];
  }
}
