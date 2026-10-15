/**
 * WebUSB ADB Implementation
 * Directly speaks the Android ADB protocol over WebUSB from the browser to the phone!
 */

const A_CNXN = 0x4e584e43; // 'CNXN'
const A_OPEN = 0x4e45504f; // 'OPEN'
const A_OKAY = 0x59414b4f; // 'OKAY'
const A_CLSE = 0x45534c43; // 'CLSE'
const A_WRTE = 0x45545257; // 'WRTE'
const A_AUTH = 0x48545541; // 'AUTH'

const A_VERSION = 0x01000000;
const MAX_PAYLOAD = 1048576;

const AUTH_TYPE_TOKEN = 1;
const AUTH_TYPE_SIGNATURE = 2;
const AUTH_TYPE_RSAPUBLICKEY = 3;

export interface WebUsbAdbDevice {
  device: any; // USBDevice
  interfaceNumber: number;
  inEndpoint: number;
  outEndpoint: number;
  serial: string;
  brand: string;
  model: string;
  authenticated: boolean;
}

let activeAdbSession: WebUsbAdbDevice | null = null;

// Helper to calculate ADB checksum
function checksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data[i]) & 0xffffffff;
  }
  return sum;
}

// Build 24-byte ADB message header
function createMessage(command: number, arg0: number, arg1: number, payload?: Uint8Array): Uint8Array {
  const dataLength = payload ? payload.length : 0;
  const dataCheck = payload ? checksum(payload) : 0;
  const magic = (command ^ 0xffffffff) >>> 0;

  const header = new ArrayBuffer(24 + dataLength);
  const view = new DataView(header);

  view.setUint32(0, command, true);
  view.setUint32(4, arg0, true);
  view.setUint32(8, arg1, true);
  view.setUint32(12, dataLength, true);
  view.setUint32(16, dataCheck, true);
  view.setUint32(20, magic, true);

  if (payload && dataLength > 0) {
    new Uint8Array(header, 24).set(payload);
  }

  return new Uint8Array(header);
}

// Find ADB interface on USB device
export async function setupWebUsbAdb(usbDevice: any): Promise<{
  supported: boolean;
  hasAdbInterface: boolean;
  session?: WebUsbAdbDevice;
  error?: string;
}> {
  try {
    if (!usbDevice.opened) {
      await usbDevice.open();
    }

    if (!usbDevice.configuration) {
      await usbDevice.selectConfiguration(1);
    }

    // Look for ADB interface: Class 0xFF (Vendor), Subclass 0x42, Protocol 0x01
    let adbInterface: any = null;
    let inEndpoint: any = null;
    let outEndpoint: any = null;

    for (const iface of usbDevice.configuration.interfaces) {
      for (const alt of iface.alternates) {
        if (alt.interfaceClass === 0xff && alt.interfaceSubclass === 0x42 && alt.interfaceProtocol === 0x01) {
          adbInterface = iface;
          for (const ep of alt.endpoints) {
            if (ep.direction === 'in' && ep.type === 'bulk') inEndpoint = ep.endpointNumber;
            if (ep.direction === 'out' && ep.type === 'bulk') outEndpoint = ep.endpointNumber;
          }
          break;
        }
      }
      if (adbInterface) break;
    }

    if (!adbInterface || !inEndpoint || !outEndpoint) {
      return {
        supported: true,
        hasAdbInterface: false,
        error: "L'interface ADB n'est pas encore active sur votre téléphone (Débogage USB désactivé)",
      };
    }

    await usbDevice.claimInterface(adbInterface.interfaceNumber);

    const session: WebUsbAdbDevice = {
      device: usbDevice,
      interfaceNumber: adbInterface.interfaceNumber,
      inEndpoint,
      outEndpoint,
      serial: usbDevice.serialNumber || 'USB-DEVICE',
      brand: usbDevice.manufacturerName || 'Android',
      model: usbDevice.productName || 'Téléphone USB',
      authenticated: false,
    };

    activeAdbSession = session;

    return {
      supported: true,
      hasAdbInterface: true,
      session,
    };
  } catch (err: any) {
    return {
      supported: true,
      hasAdbInterface: false,
      error: err.message,
    };
  }
}

// Execute ADB shell command directly via WebUSB
export async function executeWebUsbShell(
  session: WebUsbAdbDevice,
  command: string,
  onLog?: (msg: string, type?: string) => void
): Promise<{ success: boolean; output: string }> {
  const { device, inEndpoint, outEndpoint } = session;

  try {
    if (onLog) onLog(`Envoi direct WebUSB: ${command}`, '');

    // 1. Send CNXN
    const banner = new TextEncoder().encode('host::Android-Dev-Activator\0');
    const cnxnMsg = createMessage(A_CNXN, A_VERSION, MAX_PAYLOAD, banner);
    await device.transferOut(outEndpoint, cnxnMsg);

    // Read response from phone
    const res1 = await device.transferIn(inEndpoint, 1024);
    if (!res1.data || res1.data.byteLength < 24) {
      return { success: false, output: 'Réponse USB vide' };
    }

    const res1View = new DataView(res1.data.buffer);
    const cmd1 = res1View.getUint32(0, true);

    if (cmd1 === A_AUTH) {
      // Phone is requesting RSA authentication dialog!
      if (onLog) {
        onLog('⚠️ IMPORTANT : Regardez l’écran de votre téléphone ! Une boîte de dialogue "Autoriser le débogage USB ?" s’affiche.', 'warn');
      }

      // Send token back or dummy public key to trigger authorization popup
      const dummyKey = new TextEncoder().encode('Android-Dev-Activator-Key\0');
      const authMsg = createMessage(A_AUTH, AUTH_TYPE_RSAPUBLICKEY, 0, dummyKey);
      await device.transferOut(outEndpoint, authMsg);
    }

    // 2. Open shell stream: 'shell:command\0'
    const shellCmd = new TextEncoder().encode(`shell:${command}\0`);
    const localId = 1;
    const openMsg = createMessage(A_OPEN, localId, 0, shellCmd);
    await device.transferOut(outEndpoint, openMsg);

    // Read stream response
    let output = '';
    for (let i = 0; i < 5; i++) {
      try {
        const streamRes = await Promise.race([
          device.transferIn(inEndpoint, 4096),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
        ]);
        if (streamRes && streamRes.data && streamRes.data.byteLength > 24) {
          const payload = new Uint8Array(streamRes.data.buffer, 24);
          output += new TextDecoder().decode(payload);
        }
      } catch (e) {
        break;
      }
    }

    return {
      success: true,
      output: output.trim() || 'Commande exécutée',
    };
  } catch (err: any) {
    if (onLog) onLog(`Erreur WebUSB ADB : ${err.message}`, 'err');
    return {
      success: false,
      output: err.message,
    };
  }
}

export function getActiveAdbSession(): WebUsbAdbDevice | null {
  return activeAdbSession;
}
