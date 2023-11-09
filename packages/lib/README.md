# Single Sign On Client

Code that abstracts interaction with the single sign on iframe.

https://github.com/decentraland/single-sign-on <- Single Sign On webapp repo.

## Integration

1. Install the library

```sh
npm install @dcl/single-sign-on-client
```

2. Initialize the client

```ts
import { SingleSignOn } from "@dcl/single-sign-on-client";

const sso = SingleSignOn.getInstance();

await sso.init({
  src: 'https://id.decentraland.org';
})
```

The `src` argument determines the src of the SSO iframe to be created. If no src is provided. SSO will work using the applications localstorage instead of communicating with the iframe. Given that the iframe has some limitations to which origins can interact with it (https://id.decentraland.org can only receive messages from https://\*.decentraland.org sites), for local development you should not provide a src.

3. Use the corresponding SSO functions to fetch and store data.

```ts
import { SingleSignOn } from "@dcl/single-sign-on-client";

const sso = SingleSignOn.getInstance();

await sso.getConnectionData();

await sso.setConnectionData(data);

await sso.getIdentity(address);

await sso.setIdentity(address, identity);
```

To clear the data, you just have to call the `set` function with `null`

## Stored Data

**Connection Data**

Contains relevant information about the user's connection. Mainly the user's `address` and the `provider` (wallet type) used to connect.

It can be used to automatically attempt to reconnect the user with the same provider used on another application. As well as showing the user in a "semi" connected state by using it's address to fetch data without the need of connecting their wallet.


**Auth Identity**

The identity of the user. Mainly used to sign requests for authenticated endpoints. 

With the identity available, user's only need to sign it once on a single dapp and have it available on the rest of them.
