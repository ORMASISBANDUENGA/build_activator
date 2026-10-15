export interface DeviceInfo {
  serial: string;
  brand: string;
  model: string;
  androidVersion: string;
  sdk: string;
  usbMode: string;
  devModeEnabled: boolean;
  adbEnabled: boolean;
  isSimulated?: boolean;
  isWebUsb?: boolean;
  vendorId?: number;
  productId?: number;
  battery?: string;
  resolution?: string;
}

export interface LogEntry {
  id: string;
  time: string;
  text: string;
  type: 'ok' | 'err' | 'info' | 'warn';
}

export interface ActivationProgress {
  step: number;
  total: number;
  msg: string;
  active: boolean;
}

export interface PresetDevice {
  name: string;
  brand: string;
  model: string;
  androidVersion: string;
  sdk: string;
  usbMode: string;
  serial: string;
  devModeInitially: boolean;
  adbInitially: boolean;
  vendorId: number;
}
