import isURL, { IsURLOptions } from "validator/lib/isURL";
import { Action, ServerMessage, SINGLE_SIGN_ON_TARGET } from "./SingleSignOn.shared";

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
  INITIALIZED_LOCAL,
}

let initState = InitState.NOT_INITIALIZED;

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
export async function init({ src, isUrlOptions, timeout }: InitArgs = {}) {
  if (initState !== InitState.NOT_INITIALIZED) {
    console.log("SSO.init(): Cannot initialize more than once");

    return;
  }

  initState = InitState.INITIALIZING;

  try {
    if (!src) {
      throw new Error("Using local by configuration");
    }

    if (!isURL(src, { protocols: ["https"], require_valid_protocol: true, ...(isUrlOptions ?? {}) })) {
      throw new Error(`Invalid url: ${src}`);
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
    iframe.src = src;
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.position = "absolute";

    document.body.appendChild(iframe);

    await Promise.race([
      promise,
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Initialization timeout")), timeout ?? 2000)),
    ]);

    initState = InitState.INITIALIZED;

    console.log("SSO.init(): Initialized");
  } catch (e) {
    initState = InitState.INITIALIZED_LOCAL;

    console.log("SSO.init(): Initialized Locally - " + (e as Error).message);
  }
}
