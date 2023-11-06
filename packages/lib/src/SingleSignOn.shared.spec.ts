import { AuthLinkType, ProviderType } from "@dcl/schemas";
import { AuthIdentity } from "@dcl/crypto";
import { ConnectionData, LocalStorageUtils } from "./SingleSignOn.shared";

let originalLocalStorage: Storage;
let mockAddress: string;
let mockConnectionData: ConnectionData;
let mockIdentity: AuthIdentity;

beforeEach(() => {
  originalLocalStorage = global.localStorage;

  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  } as unknown as Storage;

  mockAddress = "0x24e5f44999c151f08609f8e27b2238c773c4d020";

  mockConnectionData = {
    address: mockAddress,
    provider: ProviderType.INJECTED,
  };

  mockIdentity = {
    ephemeralIdentity: {
      address: "0xF8C8E57A279c1ACAB4d4d7828365fef634FcA15e",
      publicKey:
        "0x0423553e669ddf2153b2a12147cba9f9a5d07a89ec161827779ce4567a81707cef1056097e92d80845cb1d712504b1daaaa17a8cb51f001d0ef0683e4e6b2930ec",
      privateKey: "0xWhyDoYouCare?",
    },
    expiration: (() => {
      const today = new Date();
      const tomorrow = today.getDate() + 1;
      today.setDate(tomorrow);

      return today;
    })(),
    authChain: [
      {
        type: AuthLinkType.SIGNER,
        payload: "0x24e5f44999c151f08609f8e27b2238c773c4d020",
        signature: "",
      },
      {
        type: AuthLinkType.ECDSA_PERSONAL_EPHEMERAL,
        payload:
          "Decentraland Login\nEphemeral address: 0xF8C8E57A279c1ACAB4d4d7828365fef634FcA15e\nExpiration: 2023-11-26T02:38:41.714Z",
        signature:
          "0xb83500e07d944387a56cd943222313cac18457d60fca2832280c0e0a9faa5a0e1714a5fd92aa3c38ca4076bc609f5ae81aaf1143af1519995027c3ac4978ce9d1b",
      },
    ],
  };
});

afterEach(() => {
  global.localStorage = originalLocalStorage;
});

describe("when getting the connection data from local storage", () => {
  let connectionData: ConnectionData | null;

  describe("when the local storage returns null", () => {
    beforeEach(() => {
      connectionData = null;

      global.localStorage.getItem = jest.fn().mockReturnValueOnce(connectionData);
    });

    it("should return null", () => {
      expect(LocalStorageUtils.getConnectionData()).toBeNull();
    });
  });

  describe("when the local storage returns the connection data", () => {
    beforeEach(() => {
      connectionData = mockConnectionData;

      global.localStorage.getItem = jest.fn().mockReturnValueOnce(JSON.stringify(connectionData));
    });

    it("should return the connection data", () => {
      expect(LocalStorageUtils.getConnectionData()).toEqual(connectionData);
    });
  });

  describe("when the local storage returns a string that cannot be parsed to json", () => {
    beforeEach(() => {
      global.localStorage.getItem = jest.fn().mockReturnValueOnce("invalid-json");
    });

    it("should throw an error saying that the json cannot be parsed", () => {
      expect(() => LocalStorageUtils.getConnectionData()).toThrow("Unexpected token i in JSON at position 0");
    });
  });

  describe("when the local storage returns a string that cannot be parsed into a connection data", () => {
    beforeEach(() => {
      global.localStorage.getItem = jest.fn().mockReturnValueOnce('{ "foo": "bar" }');
    });

    it("should throw an error saying that the json does not have the proper schema", () => {
      expect(() => LocalStorageUtils.getConnectionData()).toThrow(
        'Invalid connection data: [{"instancePath":"","schemaPath":"#/required","keyword":"required","params":{"missingProperty":"address"},"message":"must have required property \'address\'"}]'
      );
    });
  });
});

describe("when setting the connection data on local storage", () => {
  let connectionData: ConnectionData | null;

  describe("when providing null as connection data", () => {
    beforeEach(() => {
      connectionData = null;
    });

    it("should call the clear function from local storage", () => {
      LocalStorageUtils.setConnectionData(connectionData);

      expect(global.localStorage.removeItem).toBeCalledWith(LocalStorageUtils.CONNECTION_DATA_KEY);
    });
  });

  describe("when providing a connection data object", () => {
    beforeEach(() => {
      connectionData = mockConnectionData;
    });

    it("should call the set function from local storage", () => {
      LocalStorageUtils.setConnectionData(connectionData);

      expect(global.localStorage.setItem).toBeCalledWith(
        LocalStorageUtils.CONNECTION_DATA_KEY,
        JSON.stringify(connectionData)
      );
    });
  });

  describe("when providing a connection data object that has an invalid schema", () => {
    beforeEach(() => {
      connectionData = {} as ConnectionData;
    });

    it("should fail with an invalid connection data message", () => {
      expect(() => LocalStorageUtils.setConnectionData(connectionData)).toThrow(
        'Invalid connection data: [{"instancePath":"","schemaPath":"#/required","keyword":"required","params":{"missingProperty":"address"},"message":"must have required property \'address\'"}]'
      );
    });
  });

  describe("when providing a connection data object that has an invalid address", () => {
    beforeEach(() => {
      connectionData = mockConnectionData;
      connectionData.address = "invalid-address";
    });

    it("should fail with an invalid connection data message", () => {
      expect(() => LocalStorageUtils.setConnectionData(connectionData)).toThrow(
        'Invalid connection data: [{"instancePath":"/address","schemaPath":"#/properties/address/pattern","keyword":"pattern","params":{"pattern":"^0x[a-fA-F0-9]{40}$"},"message":"must match pattern \\"^0x[a-fA-F0-9]{40}$\\""}]'
      );
    });
  });

  describe("when providing a connection data object that has an invalid provider", () => {
    beforeEach(() => {
      connectionData = mockConnectionData;
      connectionData.provider = "invalid" as any;
    });

    it("should fail with an invalid connection data message", () => {
      expect(() => LocalStorageUtils.setConnectionData(connectionData)).toThrow(
        'Invalid connection data: [{"instancePath":"/provider","schemaPath":"#/properties/provider/enum","keyword":"enum","params":{"allowedValues":["injected","magic","formatic","network","wallet_connect","wallet_connect_v2","wallet_link","metamask_mobile"]},"message":"must be equal to one of the allowed values"}]'
      );
    });
  });
});

describe("when getting the identity from local storage", () => {
  let identity: AuthIdentity | null;

  describe("when the local storage returns null", () => {
    beforeEach(() => {
      identity = null;

      global.localStorage.getItem = jest.fn().mockReturnValueOnce(identity);
    });

    it("should return null", () => {
      expect(LocalStorageUtils.getIdentity(mockAddress)).toBeNull();
    });
  });

  describe("when the local storage returns an expired identity", () => {
    beforeEach(() => {
      identity = {
        ...mockIdentity,
        expiration: new Date(0),
      };

      global.localStorage.getItem = jest.fn().mockReturnValueOnce(JSON.stringify(identity));
    });

    it("should return null", () => {
      expect(LocalStorageUtils.getIdentity(mockAddress)).toBeNull();
    });
  });

  describe("when the local storage returns the identity", () => {
    beforeEach(() => {
      identity = mockIdentity;

      global.localStorage.getItem = jest.fn().mockReturnValueOnce(JSON.stringify(identity));
    });

    it("should return the identity", () => {
      expect(LocalStorageUtils.getIdentity(mockAddress)).toEqual(identity);
    });

    it('should return the identity with the "expiration" property as a Date', () => {
      expect(LocalStorageUtils.getIdentity(mockAddress)?.expiration).toBeInstanceOf(Date);
    });
  });

  describe("when the local storage returns a string that cannot be parsed to json", () => {
    beforeEach(() => {
      global.localStorage.getItem = jest.fn().mockReturnValueOnce("invalid-json");
    });

    it("should throw an error saying that the json cannot be parsed", () => {
      expect(() => LocalStorageUtils.getIdentity(mockAddress)).toThrow("Unexpected token i in JSON at position 0");
    });
  });

  describe("when the local storage returns a string that cannot be parsed into an identity", () => {
    beforeEach(() => {
      global.localStorage.getItem = jest.fn().mockReturnValueOnce('{ "foo": "bar" }');
    });

    it("should throw an error saying that the json does not have the proper schema", () => {
      expect(() => LocalStorageUtils.getIdentity(mockAddress)).toThrow(
        'Invalid auth identity: [{"instancePath":"","schemaPath":"#/required","keyword":"required","params":{"missingProperty":"ephemeralIdentity"},"message":"must have required property \'ephemeralIdentity\'"}]'
      );
    });
  });
});

describe("when setting the identity on local storage", () => {
  let identity: AuthIdentity | null;

  describe("when providing null as identity", () => {
    beforeEach(() => {
      identity = null;
    });

    it("should call the clear function from local storage", () => {
      LocalStorageUtils.setIdentity(mockAddress, null);

      expect(global.localStorage.removeItem).toBeCalledWith(`${LocalStorageUtils.IDENTITY_KEY}-${mockAddress}`);
    });
  });

  describe("when providing an identity object", () => {
    beforeEach(() => {
      identity = mockIdentity;
    });

    it("should call the set function from local storage", () => {
      LocalStorageUtils.setIdentity(mockAddress, identity);

      expect(global.localStorage.setItem).toBeCalledWith(
        `${LocalStorageUtils.IDENTITY_KEY}-${mockAddress}`,
        JSON.stringify(identity)
      );
    });
  });

  describe("when providing an identity object that has an invalid schema", () => {
    beforeEach(() => {
      identity = {} as AuthIdentity;
    });

    it("should fail with an invalid identity message", () => {
      expect(() => LocalStorageUtils.setIdentity(mockAddress, identity)).toThrow(
        'Invalid auth identity: [{"instancePath":"","schemaPath":"#/required","keyword":"required","params":{"missingProperty":"ephemeralIdentity"},"message":"must have required property \'ephemeralIdentity\'"}]'
      );
    });
  });

  describe("when providing an invalid address", () => {
    beforeEach(() => {
      identity = mockIdentity;
    });

    it("should fail with an invalid identity message", () => {
      expect(() => LocalStorageUtils.setIdentity("invalid", identity)).toThrow(
        'Invalid address: [{"instancePath":"","schemaPath":"#/pattern","keyword":"pattern","params":{"pattern":"^0x[a-fA-F0-9]{40}$"},"message":"must match pattern \\"^0x[a-fA-F0-9]{40}$\\""}]'
      );
    });
  });
});
