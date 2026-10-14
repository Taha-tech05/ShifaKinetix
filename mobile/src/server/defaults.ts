/** Demo server settings. Demo only, not for real patients. */

/**
 * Where the app looks for the server unless EXPO_PUBLIC_API_URL says otherwise: the host computer as seen from the Android
 * emulator. A phone needs the computer's address on the same network, for example EXPO_PUBLIC_API_URL=http://192.168.1.20:8000.
 */
export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';

/** The fixed demo accounts. The server decides each account's role; these names only say which account to sign in to. */
export const DEMO_ACCOUNTS = { patient: 'demo-patient', doctor: 'demo-doctor' } as const;

/** Set EXPO_PUBLIC_AUTO_UPLOAD=off to switch off the automatic upload at the end of the safety flow. */
export const autoUploadEnabled = () => process.env.EXPO_PUBLIC_AUTO_UPLOAD !== 'off';
