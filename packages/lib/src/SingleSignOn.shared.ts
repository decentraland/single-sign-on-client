import Ajv, { JSONSchemaType } from "ajv";
import addFormats from "ajv-formats";
import type { AuthIdentity } from "@dcl/crypto";
import { AuthChain, ProviderType } from "@dcl/schemas";

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
  provider: ProviderType;
};

export type IdentityPayload = {
  address: string;
  identity: AuthIdentity | null;
};

export type ClientMessage = {
  target: typeof SINGLE_SIGN_ON_TARGET;
  id: number;
  action: Action;
  payload?: ConnectionData | IdentityPayload | string | null;
};

export type ServerMessage = {
  target: typeof SINGLE_SIGN_ON_TARGET;
  id: number;
  action: Action;
  ok: boolean;
  payload?: ConnectionData | AuthIdentity | string | null;
};

export namespace LocalStorageUtils {
  export const IDENTITY_KEY = "single-sign-on-v2-identity";
  export const CONNECTION_DATA_KEY = "single-sign-on-v2-connection-data";

  export function getIdentity(address: string): AuthIdentity | null {
    const identityStr = localStorage.getItem(getIdentityKey(address));

    if (!identityStr) {
      return null;
    }

    const identityWithStringExpiration: Omit<AuthIdentity, "expiration"> & { expiration: string } =
      JSON.parse(identityStr);

    Validations.validateAuthIdentity(identityWithStringExpiration);

    const identity: AuthIdentity = {
      ...identityWithStringExpiration,
      expiration: new Date(identityWithStringExpiration.expiration),
    };

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
      Validations.validateAuthIdentity(JSON.parse(JSON.stringify(identity)));

      localStorage.setItem(key, JSON.stringify(identity));
    }
  }

  export function getConnectionData(): ConnectionData | null {
    const connectionDataStr = localStorage.getItem(CONNECTION_DATA_KEY);

    if (!connectionDataStr) {
      return null;
    }

    const connectionData = JSON.parse(connectionDataStr) as ConnectionData;

    Validations.validateConnectionData(connectionData);

    return connectionData as ConnectionData;
  }

  export function setConnectionData(connectionData: ConnectionData | null): void {
    if (!connectionData) {
      localStorage.removeItem(CONNECTION_DATA_KEY);
    } else {
      Validations.validateConnectionData(connectionData);

      localStorage.setItem(CONNECTION_DATA_KEY, JSON.stringify(connectionData));
    }
  }

  function getIdentityKey(address: string) {
    return `${IDENTITY_KEY}-${address}`;
  }
}

namespace Validations {
  export type AuthIdentityWithStringExpiration = Omit<AuthIdentity, "expiration"> & { expiration: string };

  const ajv = new Ajv();
  addFormats(ajv);

  const connectionDataSchema: JSONSchemaType<ConnectionData> = {
    type: "object",
    properties: {
      provider: ProviderType.schema,
      address: {
        type: "string",
        pattern: "^0x[a-fA-F0-9]{40}$",
      },
    },
    required: ["address", "provider"],
    additionalProperties: false,
  };

  const authIdentitySchema: JSONSchemaType<AuthIdentityWithStringExpiration> = {
    type: "object",
    properties: {
      authChain: AuthChain.schema,
      expiration: {
        type: "string",
        format: "date-time",
      },
      ephemeralIdentity: {
        type: "object",
        properties: {
          address: {
            type: "string",
          },
          privateKey: {
            type: "string",
          },
          publicKey: {
            type: "string",
          },
        },
        required: ["address", "privateKey", "publicKey"],
        additionalProperties: false,
      },
    },
    required: ["ephemeralIdentity", "authChain", "expiration"],
    additionalProperties: false,
  };

  const _validateConnectionData = ajv.compile(connectionDataSchema);
  const _validateAuthIdentity = ajv.compile(authIdentitySchema);

  export function validateConnectionData(connectionData: any) {
    if (!_validateConnectionData(connectionData)) {
      throw new Error(`Invalid connection data: ${JSON.stringify(_validateConnectionData.errors)}`);
    }
  }

  export function validateAuthIdentity(authIdentity: any) {
    if (!_validateAuthIdentity(authIdentity)) {
      throw new Error(`Invalid auth identity: ${JSON.stringify(_validateAuthIdentity.errors)}`);
    }
  }
}
