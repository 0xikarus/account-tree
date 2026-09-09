import { expect, test } from "bun:test";
import { derivationMessage, deriveChild, fromPrivateKey, parseIndex } from "../src/derive.js";

const key = `0x${"1".padStart(64, "0")}`;

test("prefixes sign the exact previewed message and separate same-index children", async () => {
  const root = fromPrivateKey(key).account;
  let signed;
  const wallet = { address: root.address, signMessage: (args) => {
    signed = args.message;
    return root.signMessage(args);
  } };
  const child = await deriveChild(wallet, 3, "fleet: ");
  expect(signed).toBe("fleet: 3");
  expect(signed).toBe(derivationMessage(3, "fleet: "));
  expect(child.privateKey).toBe((await deriveChild(root, 3, "fleet: ")).privateKey);
  expect(child.privateKey).not.toBe((await deriveChild(root, 3, "other:")).privateKey);
  expect((await deriveChild(root, 3, "")).privateKey).toBe((await deriveChild(root, 3)).privateKey);
  expect(derivationMessage(3, "fleet:")).toBe("fleet:3");
});

test("wallet signer and local root produce identical children", async () => {
  const root = fromPrivateKey(key).account;
  const wallet = { address: root.address, signMessage: (args) => root.signMessage(args) };
  expect((await deriveChild(wallet, 3)).privateKey).toBe((await deriveChild(root, 3)).privateKey);
  expect((await deriveChild(root, 4)).privateKey).not.toBe((await deriveChild(root, 3)).privateKey);
});

test("rejects wrong signer, malformed signatures, and declined requests", async () => {
  const root = fromPrivateKey(key).account;
  await expect(deriveChild({ ...root, address: "0x0000000000000000000000000000000000000000" }, 0)).rejects.toThrow("does not match");
  await expect(deriveChild({ ...root, signMessage: async () => "0x1234" }, 0)).rejects.toThrow("unsupported signature");
  await expect(deriveChild({ ...root, signMessage: async () => { throw new Error("declined"); } }, 0)).rejects.toThrow("declined");
});

test("validates index and key without exposing key material in errors", () => {
  for (const value of ["", "-1", "1.5", "1e3", "01", "9007199254740992", NaN]) {
    expect(() => parseIndex(value)).toThrow();
  }
  for (const value of ["secret", `0x${"0".repeat(64)}`, `0x${"f".repeat(64)}`]) {
    expect(() => fromPrivateKey(value)).toThrow(/Enter a valid/);
  }
  expect(fromPrivateKey(key.slice(2)).account.address).toBe(fromPrivateKey(key).account.address);
});
