import isURL, { IsURLOptions } from "validator/lib/isURL";
import { AuthIdentity } from "@dcl/crypto";
import {
  Action,
  ClientMessage,
  ConnectionData,
  LocalStorageUtils,
  ServerMessage,
  SINGLE_SIGN_ON_TARGET,
} from "./SingleSignOn.shared";

const IFRAME_ID = SINGLE_SIGN_ON_TARGET;

type InitArgs = {
  src?: string;
  isUrlOptions?: IsURLOptions;
  timeout?: number;
};

enum InitState {
  NOT_INITIALIZED,
  INITIALIZING,
  INITIALIZED,
}

let initState = InitState.NOT_INITIALIZED;
let isLocal = false;
let src: string | null = null;
let idCounter = 1;

/**
 * Initializes the SSO client.
 * - Should only be called once.
 * - If not being used locally, creates an iframe of the identity webapp.
 * - The iframe should not be created by any other means rather than the init function.
 *
 * If SSO is initialized locally, instead of communicating with the iframe it will work with the implementing app's local storage.
 * This is to prevent the application from blocking the user in case the iframe webapp cannot be loaded.
 * @param args.src The url of the identity webapp.
 * @param args.isUrlOptions Options for the url validation. By default it has to be an https url.
 * @param args.timeout The timeout for the initialization. By default it is 2 seconds.
 */
export async function init({ src: _src, isUrlOptions, timeout }: InitArgs = {}): Promise<void> {
  if (initState !== InitState.NOT_INITIALIZED) {
    console.log("SSO cannot be initialized more than once");

    return;
  }

  initState = InitState.INITIALIZING;

  try {
    if (!_src) {
      throw new Error("Using local by configuration");
    }

    if (!isURL(_src, { protocols: ["https"], require_valid_protocol: true, ...(isUrlOptions ?? {}) })) {
      throw new Error(`Invalid url: ${_src}`);
    }

    if (document.getElementById(IFRAME_ID)) {
      throw new Error("SSO Element was not created by this client");
    }

    const promise = new Promise<void>((resolve, reject) => {
      const handler = (event: MessageEvent<ServerMessage>) => {
        if (event.data.target !== SINGLE_SIGN_ON_TARGET || event.data.action !== Action.INIT) {
          return;
        }

        window.removeEventListener("message", handler);

        if (!event.data.ok) {
          reject(new Error(event.data.payload as string));
        }

        resolve();
      };

      window.addEventListener("message", handler);
    });

    const iframe = document.createElement("iframe");
    iframe.id = IFRAME_ID;
    iframe.src = _src;
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.position = "absolute";

    document.body.appendChild(iframe);

    await Promise.race([
      promise,
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Initialization timeout")), timeout ?? 2000)),
    ]);

    console.log("SSO initialized");
  } catch (e) {
    isLocal = true;

    console.log("SSO initialized locally, reason: " + (e as Error).message);
  }

  initState = InitState.INITIALIZED;
  src = _src ?? null;
}

export async function setConnectionData(data: ConnectionData | null): Promise<void> {
  return (await handle(Action.SET_CONNECTION_DATA, data)) as void;
}

export async function getConnectionData(): Promise<ConnectionData | null> {
  return (await handle(Action.GET_CONNECTION_DATA)) as ConnectionData | null;
}

export async function setIdentity(address: string, identity: AuthIdentity | null): Promise<void> {
  return (await handle(Action.SET_IDENTITY, { address, identity })) as void;
}

export async function getIdentity(address: string): Promise<AuthIdentity | null> {
  return ((await handle(Action.GET_IDENTITY, address)) as { address: string; identity: AuthIdentity | null }).identity;
}

async function handle(action: Action, payload?: ClientMessage["payload"]) {
  if (initState !== InitState.INITIALIZED) {
    throw new Error("SSO is not initialized");
  }

  if (isLocal) {
    switch (action) {
      case Action.SET_CONNECTION_DATA:
        return LocalStorageUtils.setConnectionData(payload as ConnectionData | null);
      case Action.GET_CONNECTION_DATA:
        return LocalStorageUtils.getConnectionData();
      default:
        throw new Error("Unsupported action");
    }
  } else {
    const iframeWindow = getIframeWindow();
    const id = idCounter++;

    const promise = new Promise<ServerMessage["payload"]>((resolve, reject) => {
      const handler = ({ data }: MessageEvent<ServerMessage>) => {
        if (data.target !== SINGLE_SIGN_ON_TARGET || data.id !== id || data.action !== action) {
          return;
        }

        window.removeEventListener("message", handler);

        !data.ok ? reject(data.payload as string) : resolve(data.payload);
      };

      window.addEventListener("message", handler);
    });

    iframeWindow.postMessage({ target: SINGLE_SIGN_ON_TARGET, id, action, payload } as ClientMessage, "*");

    return promise;
  }
}

function getIframeWindow(): Window {
  const element = document.getElementById(IFRAME_ID);

  if (!element) {
    throw new Error("Unable to obtain the SSO iframe element");
  }

  if (element.tagName !== "IFRAME") {
    throw new Error("The SSO element is not an iframe");
  }

  const iframe = element as HTMLIFrameElement;

  if (new URL(iframe.src).origin !== new URL(src!).origin) {
    throw new Error("The SSO iframe src has been modified");
  }

  const iframeWindow = iframe.contentWindow;

  if (!iframeWindow) {
    throw new Error("Unable to obtain the SSO iframe window");
  }

  return iframeWindow;
}
