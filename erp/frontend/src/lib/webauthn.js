// WebAuthn helpers for Windows Hello / biometric login

function b64urlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  bytes.forEach(b => str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function isWebAuthnSupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export async function isPlatformAuthenticatorAvailable() {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function createCredential({ challenge, rp_id, rp_name, user_id, user_name, user_display_name }) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: b64urlDecode(challenge),
      rp: { id: rp_id, name: rp_name },
      user: {
        id: new TextEncoder().encode(String(user_id)),
        name: user_name,
        displayName: user_display_name,
      },
      pubKeyCredParams: [
        { alg: -7,   type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "preferred",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  });
  return {
    credential_id: b64urlEncode(credential.rawId),
    client_data_json: b64urlEncode(credential.response.clientDataJSON),
    attestation_object: b64urlEncode(credential.response.attestationObject),
  };
}

export async function getAssertion({ challenge, rp_id, allow_credentials }) {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: b64urlDecode(challenge),
      rpId: rp_id,
      allowCredentials: allow_credentials.map(id => ({
        id: b64urlDecode(id),
        type: "public-key",
      })),
      userVerification: "preferred",
      timeout: 60000,
    },
  });
  return {
    credential_id: b64urlEncode(credential.rawId),
    client_data_json: b64urlEncode(credential.response.clientDataJSON),
    authenticator_data: b64urlEncode(credential.response.authenticatorData),
    signature: b64urlEncode(credential.response.signature),
    user_handle: credential.response.userHandle ? b64urlEncode(credential.response.userHandle) : null,
  };
}
