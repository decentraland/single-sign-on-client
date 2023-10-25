import type { AuthIdentity } from "@dcl/crypto";

export const SINGLE_SIGN_ON_TARGET = "single-sign-on";

export enum Action {
  GET_IDENTITY = "get-identity",
  SET_IDENTITY = "set-identity",
  GET_CONNECTION_DATA = "get-connection-data",
  SET_CONNECTION_DATA = "set-connection-data",
  INIT = "init",
}

export type ConnectionData = {
  address: string;
  provider: string;
};

export type ClientMessage = {
  target: typeof SINGLE_SIGN_ON_TARGET;
  id: number;
  action: Action;
  payload?: ConnectionData | { address: string; identity: AuthIdentity };
};

export type ServerMessage = {
  target: typeof SINGLE_SIGN_ON_TARGET;
  id: number;
  action: Action;
  ok: boolean;
  payload?: ConnectionData | { address: string; identity: AuthIdentity } | string;
};

export namespace LocalStorageUtils {
  const IDENTITY_KEY = "single-sign-on-v2-identity";
  const CONNECTION_DATA_KEY = "single-sign-on-v2-connection-data";

  export function getIdentity(address: string): AuthIdentity | null {
    const lsIdentity = localStorage.getItem(getIdentityKey(address));

    if (!lsIdentity) {
      return null;
    }

    const identity: AuthIdentity = JSON.parse(lsIdentity);

    identity.expiration = new Date(identity.expiration);

    if (identity.expiration.getTime() <= Date.now()) {
      return null;
    }

    return identity;
  }

  export function setIdentity(address: string, identity: AuthIdentity | null): void {
    const key = getIdentityKey(address);

    if (!identity) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(identity));
    }
  }

  export function getConnectionData(): ConnectionData | null {
    const connectionData = localStorage.getItem(CONNECTION_DATA_KEY);

    if (!connectionData) {
      return null;
    }

    return JSON.parse(connectionData) as ConnectionData;
  }

  export function setConnectionData(connectionData: ConnectionData | null): void {
    if (!connectionData) {
      localStorage.removeItem(CONNECTION_DATA_KEY);
    } else {
      localStorage.setItem(CONNECTION_DATA_KEY, JSON.stringify(connectionData));
    }
  }

  function getIdentityKey(address: string) {
    return `${IDENTITY_KEY}-${address}`;
  }
}
