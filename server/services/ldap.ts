/**
 * Phase 6: Active Directory / LDAP SSO Service
 *
 * Uses ldapauth-fork to authenticate users against a corporate AD/LDAP server.
 * On successful authentication it returns the user's AD attributes so the caller
 * can auto-provision or update the local user record.
 */

// Types for ldapauth-fork are declared in server/types/ldapauth-fork.d.ts
import LdapAuth from "ldapauth-fork";
import { db } from "../db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LdapConfig {
  enabled: boolean;
  url: string;           // ldap://192.168.1.1:389
  baseDn: string;        // DC=agp,DC=com
  bindDn: string;        // CN=svc-gatepass,OU=ServiceAccounts,DC=agp,DC=com
  bindPassword: string;
  searchBase: string;    // OU=Users,DC=agp,DC=com
  usernameAttr: string;  // sAMAccountName
  emailAttr: string;     // mail
  displayNameAttr: string; // displayName
  departmentAttr: string;  // department
  phoneAttr: string;       // telephoneNumber
}

export interface LdapUserInfo {
  username: string;
  email: string;
  fullName: string;
  department: string;
  phoneNumber: string;
}

// ─── DB Helpers ──────────────────────────────────────────────────────────────

export async function getLdapConfig(companyId: number): Promise<LdapConfig | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company) return null;

  return {
    enabled: company.ldapEnabled ?? false,
    url: company.ldapUrl ?? "",
    baseDn: company.ldapBaseDn ?? "",
    bindDn: company.ldapBindDn ?? "",
    bindPassword: company.ldapBindPassword ?? "",
    searchBase: company.ldapSearchBase ?? "",
    usernameAttr: company.ldapUsernameAttr ?? "sAMAccountName",
    emailAttr: company.ldapEmailAttr ?? "mail",
    displayNameAttr: company.ldapDisplayNameAttr ?? "displayName",
    departmentAttr: company.ldapDepartmentAttr ?? "department",
    phoneAttr: company.ldapPhoneAttr ?? "telephoneNumber",
  };
}

export async function saveLdapConfig(
  companyId: number,
  config: Partial<LdapConfig>
): Promise<void> {
  const update: Record<string, unknown> = {
    ldapEnabled: config.enabled ?? false,
    ldapUrl: config.url ?? null,
    ldapBaseDn: config.baseDn ?? null,
    ldapBindDn: config.bindDn ?? null,
    ldapSearchBase: config.searchBase ?? null,
    ldapUsernameAttr: config.usernameAttr ?? "sAMAccountName",
    ldapEmailAttr: config.emailAttr ?? "mail",
    ldapDisplayNameAttr: config.displayNameAttr ?? "displayName",
    ldapDepartmentAttr: config.departmentAttr ?? "department",
    ldapPhoneAttr: config.phoneAttr ?? "telephoneNumber",
  };

  // Only overwrite the stored password if caller provides a non-empty one.
  if (config.bindPassword) {
    update.ldapBindPassword = config.bindPassword;
  }

  await db
    .update(companies)
    .set(update as any)
    .where(eq(companies.id, companyId));
}

// ─── Core LDAP Operations ────────────────────────────────────────────────────

/**
 * Test whether the service-account bind succeeds (no user auth needed).
 * Returns true on success, throws on failure.
 */
export async function testLdapConnection(config: LdapConfig): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const auth = new LdapAuth({
      url: config.url,
      bindDN: config.bindDn,
      bindCredentials: config.bindPassword,
      searchBase: config.searchBase,
      searchFilter: `(${config.usernameAttr}=test-connection)`,
      tlsOptions: { rejectUnauthorized: false },
      reconnect: false,
    });

    // A "No Such Object" or similar LDAP error on a search still means the
    // bind itself succeeded — that is sufficient for a connection test.
    auth.authenticate("__test__", "__test__", (err) => {
      auth.close();
      // LDAP errors like 49 (invalid credentials for __test__) or 32 (no such
      // object) just mean the bind worked but the fake user wasn't found.
      // A network / configuration error will have a different code.
      const errMsg = typeof err === "string" ? err : err?.message ?? "";
      if (!err || errMsg.includes("Invalid credentials") || errMsg.includes("No Such Object")) {
        return resolve(true);
      }
      reject(err);
    });
  });
}

/**
 * Authenticate a user against LDAP and return their AD attributes.
 */
export async function authenticateWithLdap(
  config: LdapConfig,
  username: string,
  password: string
): Promise<LdapUserInfo> {
  return new Promise((resolve, reject) => {
    const auth = new LdapAuth({
      url: config.url,
      bindDN: config.bindDn,
      bindCredentials: config.bindPassword,
      searchBase: config.searchBase,
      searchFilter: `(${config.usernameAttr}={{username}})`,
      searchAttributes: [
        config.usernameAttr,
        config.emailAttr,
        config.displayNameAttr,
        config.departmentAttr,
        config.phoneAttr,
        "dn",
      ],
      tlsOptions: { rejectUnauthorized: false },
      reconnect: false,
    });

    auth.authenticate(username, password, (err, user) => {
      auth.close((closeErr: string | Error | null | undefined) => {
        if (closeErr) console.error("LDAP close error:", closeErr);
      });

      if (err) {
        const msg = (typeof err === "string" ? err : err?.message) || "Authentication failed";
        // Surface friendly messages for common LDAP error codes.
        if (msg.includes("Invalid credentials") || msg.includes("49")) {
          return reject(new Error("Invalid username or password"));
        }
        return reject(new Error(msg));
      }

      if (!user) {
        return reject(new Error("Authentication failed — user not found in directory"));
      }

      const str = (attr: string) => {
        const v = user[attr];
        if (Array.isArray(v)) return String(v[0] ?? "");
        return v ? String(v) : "";
      };

      resolve({
        username: str(config.usernameAttr) || username,
        email: str(config.emailAttr) || `${username}@unknown`,
        fullName: str(config.displayNameAttr) || username,
        department: str(config.departmentAttr) || "Unknown",
        phoneNumber: str(config.phoneAttr),
      });
    });
  });
}
