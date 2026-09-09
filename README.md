# Agent-ready account derivation

Give your agents accounts you can recover.

Trust your agents with a repeatable way to generate wallets. Account Tree derives EVM accounts from a root wallet and a chosen prefix and nonce, so a lost agent session does not have to mean lost access to funds. Keep the root and the exact derivation steps, and recreate the same accounts whenever you need them.

## Use it

Serve this directory with any static web server on localhost or HTTPS, then open `index.html`. Everything runs in your browser using locally bundled viem.

1. Connect a browser wallet or enter a private key.
2. Choose a prefix, such as `agent:research:`, and a nonce, such as `0`.
3. Review the exact message and derive the account.
4. Expand a child to derive further descendants. Copy addresses or reveal local private keys as needed.

Delete removes a wallet and its descendants from the view. Clear discards the whole tree. Neither action changes on-chain balances; the same derivation can recreate the accounts.

## Hardware wallets

You can also use a hardware wallet through a compatible browser wallet, such as [Ledger or Trezor connected to MetaMask](https://support.metamask.io/more-web3/wallets/how-to-connect-a-trezor-or-ledger-hardware-wallet). Select its account and approve the message on your device. The root key stays on the device; derived wallets are local accounts in the browser.

## Account tree with viem

Each signed message becomes a child wallet. That wallet can sign another message to create its own children.

```js
import { keccak256 } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// root is a connected viem Wallet Client with an account selected,
// or a local viem account.
const signature = await root.signMessage({ message: 'agent:0' })
const wallet1 = privateKeyToAccount(keccak256(signature))

const childSignature = await wallet1.signMessage({ message: 'task:0' })
const wallet1Child = privateKeyToAccount(keccak256(childSignature))
```

```text
Root wallet (browser wallet, hardware wallet, or private key)
├── signMessage('agent:0') → keccak256 → Wallet 1
│   ├── signMessage('task:0') → keccak256 → Wallet 1.1
│   └── signMessage('task:1') → keccak256 → Wallet 1.2
└── signMessage('agent:1') → keccak256 → Wallet 2
```

## Give agents a recovery recipe

Record the root address and, for every level, the exact prefix, nonce, and resulting address. Store the root key securely outside the agent's disposable session. A root address alone cannot recover a wallet.

For example, prefix `agent:research:` and nonce `0` sign `agent:research:0`. No separators are added, and whitespace is preserved. Each child becomes the parent for the next level.

```text
message   = prefix + decimal nonce
signature = parent.signMessage(message)  // EIP-191 personal_sign
child key = keccak256(signature)
```

Local private-key signing is deterministic. Connected wallets must return identical signature bytes to recover identical children; verify repeatability with your wallet before relying on it. The nonce here is a derivation index, not a transaction nonce or BIP-32 path. EOA wallets only.
