import { x25519 } from '@noble/curves/ed25519.js';

export type RealityKeyPair = {
  privateKey: string;
  publicKey: string;
};

export function generateRealityKeyPair(): RealityKeyPair {
  const { secretKey, publicKey } = x25519.keygen();

  return {
    privateKey: encodeBase64Url(secretKey),
    publicKey: encodeBase64Url(publicKey),
  };
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
