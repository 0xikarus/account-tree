import { keccak256, recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export function parseIndex(value) {
  if (!/^(0|[1-9][0-9]*)$/.test(String(value))) throw new Error("Enter a non-negative whole index.");
  const index = Number(value);
  if (!Number.isSafeInteger(index)) throw new Error("Index exceeds the safe integer limit.");
  return index;
}

export function fromPrivateKey(value) {
  const key = value.trim();
  const normalized = key.startsWith("0x") ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) throw new Error("Enter a valid 32-byte private key.");
  try {
    return { account: privateKeyToAccount(normalized), privateKey: normalized };
  } catch {
    throw new Error("Enter a valid secp256k1 private key.");
  }
}

export function derivationMessage(value, prefix = "") {
  return `${prefix}${parseIndex(value)}`;
}

export async function deriveChild(parent, value, prefix = "") {
  const message = derivationMessage(value, prefix);
  const signature = await parent.signMessage({ message });
  let recovered;
  try {
    recovered = await recoverMessageAddress({ message, signature });
  } catch {
    throw new Error("Wallet returned an unsupported signature. Use an EOA wallet.");
  }
  if (recovered.toLowerCase() !== parent.address.toLowerCase()) {
    throw new Error("Signature does not match the selected parent account.");
  }
  return fromPrivateKey(keccak256(signature));
}
