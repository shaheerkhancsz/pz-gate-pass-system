declare module "ldapauth-fork" {
  interface Options {
    url: string;
    bindDN?: string;
    bindCredentials?: string;
    searchBase: string;
    searchFilter: string;
    searchAttributes?: string[];
    tlsOptions?: Record<string, unknown>;
    reconnect?: boolean;
  }
  class LdapAuth {
    constructor(options: Options);
    authenticate(
      username: string,
      password: string,
      callback: (err: string | Error | null, user?: Record<string, unknown>) => void
    ): void;
    close(callback?: (err?: string | Error | null) => void): void;
  }
  export = LdapAuth;
}
