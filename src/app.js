import { createWalletClient, custom, getAddress } from "viem";
import { derivationMessage, deriveChild, fromPrivateKey, parseIndex } from "./derive.js";

const $ = (id) => document.getElementById(id);
const providers = [];
const roots = new Map();
let generation = 0;
let busy = false;

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function status(message) { $("status").textContent = message; }

async function run(action, isValid = () => true) {
  if (busy) return;
  busy = true;
  const current = generation;
  try {
    await action(() => current === generation && isValid());
  } catch (error) {
    if (current === generation && isValid()) {
      // Provider errors can contain the signing request; never render their payloads.
      status(error?.code === 4001 ? "Wallet request declined." : "Could not complete the request. Check the input, wallet connection, and selected account.");
    }
  } finally {
    busy = false;
  }
}

function button(label, action) {
  const node = element("button", label);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function renderNode(record, path, container, source, onDelete) {
  const children = new Map();
  const item = element("li");
  const directory = element("details");
  const summary = element("summary");
  summary.append(element("a", `${path}/`), " ", element("code", record.account.address), ` (${source})`);
  if (onDelete) {
    summary.append(" ", button("Delete", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onDelete();
      item.remove();
      status(`Removed ${record.account.address} and its descendants from the view.`);
    }));
  }
  directory.append(summary);
  directory.append(button("Copy address", () => run(async () => {
    await navigator.clipboard.writeText(record.account.address);
    if (item.isConnected) status("Address copied.");
  }, () => item.isConnected)));
  if (record.privateKey) {
    const key = element("code");
    key.className = "key";
    key.hidden = true;
    const reveal = button("Reveal private key", () => {
      key.hidden = !key.hidden;
      key.textContent = key.hidden ? "" : record.privateKey;
      reveal.textContent = key.hidden ? "Reveal private key" : "Hide private key";
    });
    directory.append(" ", reveal, key);
  }
  const form = element("form");
  const prefixLabel = element("label", "Prefix ");
  const prefix = element("input");
  prefix.type = "text";
  prefix.placeholder = "optional";
  prefixLabel.append(prefix);
  const label = element("label", "Nonce / child index ");
  const input = element("input");
  input.type = "number";
  input.min = "0";
  input.max = String(Number.MAX_SAFE_INTEGER);
  input.step = "1";
  input.value = "0";
  input.required = true;
  label.append(input);
  const submit = element("button", "Derive child");
  submit.type = "submit";
  const preview = element("p");
  const updatePreview = () => {
    try {
      preview.textContent = `Message to sign: ${JSON.stringify(derivationMessage(input.value, prefix.value))}`;
    } catch {
      preview.textContent = "Enter a valid nonce to preview the message.";
    }
  };
  form.addEventListener("input", updatePreview);
  updatePreview();
  form.append(prefixLabel, " ", label, " ", submit, preview);
  const listing = element("ul");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void run(async (active) => {
      const index = parseIndex(input.value);
      const prefixValue = prefix.value;
      const message = derivationMessage(index, prefixValue);
      const childPath = `${path}/${encodeURIComponent(message)}`;
      if (children.has(message)) {
        children.get(message).open = true;
        status(`Message ${JSON.stringify(message)} already has a child under ${record.account.address}.`);
        return;
      }
      status(source === "wallet" ? `Approve signing the message ${JSON.stringify(message)} in your wallet.` : `Deriving child ${JSON.stringify(message)}…`);
      submit.disabled = true;
      try {
        const child = await deriveChild(record.account, index, prefixValue);
        if (!active()) return;
        children.set(message, renderNode(child, childPath, listing, "local", () => children.delete(message)));
        input.value = String(index < Number.MAX_SAFE_INTEGER ? index + 1 : index);
        updatePreview();
        status(`Derived ${child.account.address} from ${record.account.address} using message ${JSON.stringify(message)}.`);
      } finally {
        submit.disabled = false;
      }
    }, () => item.isConnected);
  });
  directory.append(form, listing);
  item.append(directory);
  container.append(item);
  directory.open = true;
  return directory;
}

function addRoot(record, source) {
  const id = `${source}:${record.account.address}`;
  if (roots.has(id)) {
    roots.get(id).open = true;
    status("This root is already listed.");
    return;
  }
  const path = `root-${roots.size}`;
  roots.set(id, renderNode(record, path, $("tree"), source));
  $("empty").hidden = true;
  status(`Added ${source} root ${record.account.address}.`);
}

$("import").addEventListener("submit", (event) => {
  event.preventDefault();
  if (busy) return;
  try {
    const record = fromPrivateKey($("private-key").value);
    $("private-key").value = "";
    addRoot(record, "private key");
  } catch (error) {
    status(error.message);
  }
});

function addProvider(provider, name) {
  if (!provider || providers.some((entry) => entry.provider === provider)) return;
  providers.push({ provider, name });
  if (providers.length === 1) $("wallets").replaceChildren();
  const option = element("option", name);
  option.value = String(providers.length - 1);
  $("wallets").append(option);
}

window.addEventListener("eip6963:announceProvider", (event) => {
  addProvider(event.detail?.provider, event.detail?.info?.name || "Browser wallet");
});
window.dispatchEvent(new Event("eip6963:requestProvider"));
if (providers.length === 0) addProvider(window.ethereum, "Browser wallet");
if (providers.length === 0) $("wallets").options[0].textContent = "No browser wallet detected";

$("connect").addEventListener("click", () => run(async (active) => {
  const selected = providers[Number($("wallets").value)];
  if (!selected) { status("Install or enable a browser wallet, then reload."); return; }
  status("Waiting for wallet connection…");
  const wallet = createWalletClient({ transport: custom(selected.provider) });
  const addresses = await wallet.requestAddresses();
  if (!active()) return;
  const address = getAddress(addresses[0]);
  addRoot({ account: {
    address,
    async signMessage({ message }) {
      const available = await wallet.getAddresses();
      if (!available[0] || getAddress(available[0]) !== address) throw new Error("Selected wallet account changed.");
      return wallet.signMessage({ account: address, message });
    },
  } }, "wallet");
}));

$("clear").addEventListener("click", () => {
  generation++;
  roots.clear();
  $("tree").replaceChildren();
  $("empty").hidden = false;
  $("private-key").value = "";
  status(busy ? "Accounts cleared. Dismiss the pending wallet request before continuing." : "Accounts cleared.");
});
