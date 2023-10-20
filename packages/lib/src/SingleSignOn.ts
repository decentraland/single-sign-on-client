import type { AuthIdentity } from "@dcl/crypto";
import isURL, { IsURLOptions } from "validator/lib/isURL";
import {
  Action,
  ClientMessage,
  ServerMessage,
  SINGLE_SIGN_ON_TARGET,
  createMessage,
  localStorageGetIdentity,
  localStorageStoreIdentity,
  localStorageClearIdentity,
} from "./SingleSignOn.shared";

// The id used to identify the iframe.
const IFRAME_ID = SINGLE_SIGN_ON_TARGET;

// The timeout in milliseconds to wait for the response of the iframe.
// This is used to avoid waiting indefinitely for a response.
const GET_IFRAME_TIMEOUT = 500;

// The number of times to retry getting the iframe.
// After this number of retries, an error is thrown.
const GET_IFRAME_RETRIES = 5;

// Used as the id to identify messages.
// It is incremented every time a message is sent.
let _counter = 0;

// The url of the iframe.
// Being an empty string or not indicates if the iframe has been initialized with the `init` function.
let _src = "";

const defaultOptions: IsURLOptions = {
  protocols: ["https"],
  require_valid_protocol: true,
};

// Initializes the client by appending the SSO iframe to the document.
export function init(src: string, options: IsURLOptions = {}) {
  if (!isURL(src, { ...defaultOptions, ...options })) {
    throw new Error(`Invalid url: ${src}`);
  }

  if (_src) {
    throw new Error("Already initialized");
  }

  const iframe = document.createElement("iframe");
  iframe.id = IFRAME_ID;
  iframe.src = src;
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.position = "absolute";

  document.body.appendChild(iframe);

  _src = src;
}

// Gets the identity of the given user from the iframe.
// Fallbacks to the current application's local storage if communication with the iframe fails.
export async function getIdentity(user: string): Promise<AuthIdentity | null> {
  let identity: AuthIdentity | null;

  try {
    const message = await postMessage(await getIframe(), Action.GET, { user });
    identity = message.identity ?? null;
  } catch (e) {
    logFallback(e as Error);
    identity = localStorageGetIdentity(user);
  }

  return identity;
}

// Stores the identity of the given user into the iframe.
// Fallbacks to the current application's local storage if communication with the iframe fails.
export async function storeIdentity(
  user: string,
  identity: AuthIdentity
): Promise<void> {
  try {
    await postMessage(await getIframe(), Action.STORE, { user, identity });
  } catch (e) {
    logFallback(e as Error);
    localStorageStoreIdentity(user, identity);
  }
}

// Clears the identity of the given user from the iframe.
// Fallbacks to the current application's local storage if communication with the iframe fails.
export async function clearIdentity(user: string): Promise<void> {
  try {
    await postMessage(await getIframe(), Action.CLEAR, { user });
  } catch (e) {
    logFallback(e as Error);
    localStorageClearIdentity(user);
  }
}

// Gets the iframe content window used to communicate with the iframe through postMessage.
// Has a retry mechanism to wait for the iframe to be ready.
// This has been implemented because some time might pass between the iframe being created and the iframe being ready to communicate.
async function getIframe() {
  if (!_src) {
    throw new Error("Not initialized");
  }

  for (let i = 0; i < GET_IFRAME_RETRIES; i++) {
    const element = document.getElementById(
      IFRAME_ID
    ) as HTMLIFrameElement | null;

    const contentWindow = element?.contentWindow;

    if (!contentWindow) {
      await wait(GET_IFRAME_TIMEOUT);
      continue;
    }

    try {
      await postMessage(contentWindow, Action.PING, {}, GET_IFRAME_TIMEOUT);
    } catch (e) {
      continue;
    }

    return contentWindow;
  }

  throw new Error(
    "Could not get iframe because it is not ready or cannot be communicated with"
  );
}

// Simulates a request-response communication with the iframe.
// Sends a message to the iframe with a distinguishable id and waits for the response with the same id.
async function postMessage(
  iframe: Window,
  action: Action,
  payload: Pick<ClientMessage, "user" | "identity">,
  timeout = 0
) {
  _counter++;

  const id = _counter;

  let handler: ((event: MessageEvent) => void) | null = null;

  const request = new Promise<ServerMessage>((resolve, reject) => {
    handler = ({ data }: MessageEvent<ServerMessage>) => {
      if (!data || data.target !== SINGLE_SIGN_ON_TARGET || data.id !== id) {
        return;
      }

      if (data.error) {
        reject(new Error(data.error));
      } else {
        resolve(data);
      }
    };

    window.addEventListener("message", handler);
  });

  iframe.postMessage(createMessage({ id, action, ...payload }), _src);

  try {
    return await (timeout
      ? Promise.race([
          request,
          new Promise<ServerMessage>((_, reject) =>
            setTimeout(
              () => reject(new Error("Did not receive a response in time")),
              timeout
            )
          ),
        ])
      : request);
  } catch (error) {
    throw error;
  } finally {
    if (handler) {
      window.removeEventListener("message", handler);
    }
  }
}

// Helper function to wait for a given amount of time in milliseconds.
function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to log a warning when the iframe cannot be communicated with.
function logFallback(error: Error) {
  console.warn(
    "Could not get identity from iframe, falling back to localStorage. Error:",
    error.message
  );
}
