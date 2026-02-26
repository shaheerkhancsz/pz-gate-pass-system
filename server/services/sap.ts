/**
 * SAP ERP Integration Service — Phase 5
 *
 * Communicates with SAP via OData v2 APIs (compatible with SAP ECC and S4HANA).
 * Supports syncing Customers (Business Partners), Products (Materials), and Employees.
 * Also handles inbound Sale Order webhooks to auto-create draft gate passes.
 */

import { db } from '../db';
import * as schema from '@shared/schema';
import { and, eq, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// =============================================
// Types
// =============================================

export interface SapConfig {
  enabled: boolean;
  baseUrl: string;       // e.g. https://my-sap.example.com
  username: string;
  password: string;
  clientId: string;      // SAP mandant/client number, e.g. "100"
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: number;
  errorDetails: string[];
}

// SAP OData response shapes
interface SapBusinessPartner {
  BusinessPartner: string;
  BusinessPartnerFullName: string;
  BusinessPartnerCategory: string; // '1'=Person, '2'=Organisation
  PhoneNumber?: string;
  EmailAddress?: string;
  StreetName?: string;
  CityName?: string;
  Country?: string;
}

interface SapMaterial {
  Material: string;          // Material code / SKU
  MaterialName?: string;
  MaterialType?: string;
  BaseUnit?: string;
  MaterialDescription?: string;
}

interface SapEmployee {
  EmployeeID?: string;
  PersonnelNumber?: string;
  FirstName: string;
  LastName: string;
  EmailAddress?: string;
  Department?: string;
  Position?: string;
}

interface SapSaleOrderHeader {
  SalesOrder: string;
  SoldToParty: string;
  SoldToPartyName?: string;
  RequestedDeliveryDate?: string;
  SalesOrganization?: string;
  ShippingCondition?: string;
  CustomerReference?: string;
}

interface SapSaleOrderItem {
  SalesOrder: string;
  SalesOrderItem: string;
  Material: string;
  MaterialDescription?: string;
  OrderQuantity: string;
  OrderQuantityUnit?: string;
}

// =============================================
// Core HTTP helpers
// =============================================

function makeAuthHeader(config: SapConfig): string {
  const encoded = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Perform a GET request against a SAP OData endpoint.
 * Returns the parsed JSON response body.
 */
export async function sapGet(config: SapConfig, path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(path, config.baseUrl);
  url.searchParams.set('$format', 'json');
  url.searchParams.set('sap-client', config.clientId);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: makeAuthHeader(config),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30_000), // 30 second timeout
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SAP API error ${response.status}: ${body}`);
  }

  return response.json();
}

/**
 * Extract the results array from an OData v2 response.
 * Handles both `{ d: { results: [] } }` and `{ d: {...} }` shapes.
 */
function extractResults(data: any): any[] {
  if (Array.isArray(data?.d?.results)) return data.d.results;
  if (Array.isArray(data?.value)) return data.value;
  if (data?.d && typeof data.d === 'object') return [data.d];
  return [];
}

// =============================================
// Config management
// =============================================

/**
 * Read SAP config for a company from the companies table.
 */
export async function getSapConfig(companyId: number): Promise<SapConfig | null> {
  const [company] = await db
    .select()
    .from(schema.companies)
    .where(eq(schema.companies.id, companyId))
    .limit(1);

  if (!company) return null;

  const c = company as any;
  return {
    enabled: Boolean(c.sapEnabled),
    baseUrl: c.sapBaseUrl || '',
    username: c.sapUsername || '',
    password: c.sapPassword || '',
    clientId: c.sapClientId || '100',
  };
}

/**
 * Save SAP config for a company.
 */
export async function saveSapConfig(companyId: number, config: Partial<SapConfig>): Promise<void> {
  await db
    .update(schema.companies)
    .set({
      sapEnabled: config.enabled ?? false,
      sapBaseUrl: config.baseUrl || null,
      sapUsername: config.username || null,
      sapPassword: config.password || null,
      sapClientId: config.clientId || null,
    } as any)
    .where(eq(schema.companies.id, companyId));
}

/**
 * Test the SAP connection by fetching the service document.
 */
export async function testSapConnection(config: SapConfig): Promise<{ success: boolean; message: string }> {
  try {
    // Ping the metadata endpoint — lightweight and doesn't require specific service auth
    await sapGet(config, '/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata');
    return { success: true, message: 'Connection successful' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// =============================================
// Fetch functions
// =============================================

/**
 * Fetch business partners (customers/vendors) from SAP.
 * Defaults to BusinessPartnerCategory '2' (organisations).
 */
export async function fetchCustomersFromSap(config: SapConfig): Promise<SapBusinessPartner[]> {
  const data = await sapGet(
    config,
    '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner',
    {
      '$filter': "BusinessPartnerCategory eq '2'",
      '$select': 'BusinessPartner,BusinessPartnerFullName,BusinessPartnerCategory',
      '$expand': 'to_BusinessPartnerAddress',
      '$top': '500',
    }
  );
  return extractResults(data);
}

/**
 * Fetch materials/products from SAP.
 */
export async function fetchProductsFromSap(config: SapConfig): Promise<SapMaterial[]> {
  const data = await sapGet(
    config,
    '/sap/opu/odata/sap/API_PRODUCT/A_Product',
    {
      '$select': 'Material,BaseUnit',
      '$expand': 'to_Description',
      '$top': '1000',
    }
  );
  return extractResults(data);
}

/**
 * Fetch employees from SAP HCM.
 */
export async function fetchEmployeesFromSap(config: SapConfig): Promise<SapEmployee[]> {
  const data = await sapGet(
    config,
    '/sap/opu/odata/sap/HCM_EMPLOYEE_SRV/Employees',
    { '$top': '500' }
  );
  return extractResults(data);
}

/**
 * Fetch a specific sale order and its items from SAP.
 */
export async function fetchSaleOrder(
  config: SapConfig,
  salesOrderId: string
): Promise<{ header: SapSaleOrderHeader; items: SapSaleOrderItem[] }> {
  const data = await sapGet(
    config,
    `/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder('${salesOrderId}')`,
    { '$expand': 'to_Item' }
  );

  const header = data?.d as SapSaleOrderHeader;
  const items = extractResults(data?.d?.to_Item);
  return { header, items };
}

// =============================================
// Sync functions
// =============================================

/**
 * Sync customers (SAP Business Partners → customers table).
 * Uses sapId as the upsert key.
 */
export async function syncCustomers(companyId: number): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, created: 0, updated: 0, errors: 0, errorDetails: [] };

  const config = await getSapConfig(companyId);
  if (!config || !config.enabled) {
    result.errorDetails.push('SAP is not enabled for this company');
    return result;
  }

  let sapCustomers: SapBusinessPartner[];
  try {
    sapCustomers = await fetchCustomersFromSap(config);
  } catch (err) {
    result.errorDetails.push(`Failed to fetch from SAP: ${err instanceof Error ? err.message : String(err)}`);
    result.errors++;
    return result;
  }

  for (const bp of sapCustomers) {
    try {
      const sapId = bp.BusinessPartner;
      const name = bp.BusinessPartnerFullName || `BP-${sapId}`;

      // Resolve address from expanded navigation
      const addrResults = (bp as any).to_BusinessPartnerAddress?.results || [];
      const addr = addrResults[0] || {};
      const phone = addr.PhoneNumber || bp.PhoneNumber || null;
      const address = [addr.StreetName, addr.CityName, addr.Country].filter(Boolean).join(', ') || null;
      const email = addr.EmailAddress || bp.EmailAddress || null;

      // Check if exists
      const [existing] = await db
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(and(
          eq((schema.customers as any).sapId, sapId),
          eq((schema.customers as any).companyId, companyId)
        ))
        .limit(1);

      if (existing) {
        await db
          .update(schema.customers)
          .set({ name, phone: phone || undefined, address: address || undefined, email: email || undefined } as any)
          .where(eq(schema.customers.id, existing.id));
        result.updated++;
      } else {
        await db.insert(schema.customers).values({
          companyId,
          name,
          phone: phone || undefined,
          address: address || undefined,
          email: email || undefined,
          sapId,
          syncedFromSap: true,
        } as any);
        result.created++;
      }
      result.synced++;
    } catch (err) {
      result.errors++;
      result.errorDetails.push(`BP ${bp.BusinessPartner}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Update lastSapSyncAt
  await db.update(schema.companies).set({ lastSapSyncAt: new Date() } as any).where(eq(schema.companies.id, companyId));

  return result;
}

/**
 * Sync products (SAP Materials → products table).
 */
export async function syncProducts(companyId: number): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, created: 0, updated: 0, errors: 0, errorDetails: [] };

  const config = await getSapConfig(companyId);
  if (!config || !config.enabled) {
    result.errorDetails.push('SAP is not enabled for this company');
    return result;
  }

  let sapMaterials: SapMaterial[];
  try {
    sapMaterials = await fetchProductsFromSap(config);
  } catch (err) {
    result.errorDetails.push(`Failed to fetch from SAP: ${err instanceof Error ? err.message : String(err)}`);
    result.errors++;
    return result;
  }

  for (const mat of sapMaterials) {
    try {
      const sapMaterialCode = mat.Material;
      // Description may come from expanded navigation to_Description
      const descResults = (mat as any).to_Description?.results || [];
      const name = descResults[0]?.MaterialDescription || mat.MaterialDescription || mat.MaterialName || sapMaterialCode;
      const unit = mat.BaseUnit || null;

      const [existing] = await db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(and(
          eq(schema.products.sapMaterialCode, sapMaterialCode),
          eq(schema.products.companyId, companyId)
        ))
        .limit(1);

      if (existing) {
        await db
          .update(schema.products)
          .set({ name, unit: unit || undefined } as any)
          .where(eq(schema.products.id, existing.id));
        result.updated++;
      } else {
        await db.insert(schema.products).values({
          companyId,
          name,
          sku: sapMaterialCode,
          unit: unit || undefined,
          sapMaterialCode,
          syncedFromSap: true,
          active: true,
        });
        result.created++;
      }
      result.synced++;
    } catch (err) {
      result.errors++;
      result.errorDetails.push(`Material ${mat.Material}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await db.update(schema.companies).set({ lastSapSyncAt: new Date() } as any).where(eq(schema.companies.id, companyId));

  return result;
}

/**
 * Sync employees (SAP HCM Employees → users table).
 * Imported employees are created as inactive users. Admins must activate and assign roles.
 */
export async function syncEmployees(companyId: number): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, created: 0, updated: 0, errors: 0, errorDetails: [] };

  const config = await getSapConfig(companyId);
  if (!config || !config.enabled) {
    result.errorDetails.push('SAP is not enabled for this company');
    return result;
  }

  let sapEmployees: SapEmployee[];
  try {
    sapEmployees = await fetchEmployeesFromSap(config);
  } catch (err) {
    result.errorDetails.push(`Failed to fetch from SAP: ${err instanceof Error ? err.message : String(err)}`);
    result.errors++;
    return result;
  }

  for (const emp of sapEmployees) {
    try {
      const email = emp.EmailAddress;
      if (!email) {
        result.errors++;
        result.errorDetails.push(`Employee ${emp.EmployeeID || emp.PersonnelNumber}: no email address, skipped`);
        continue;
      }

      const fullName = [emp.FirstName, emp.LastName].filter(Boolean).join(' ') || email;
      const department = emp.Department || 'Unassigned';

      const [existing] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (existing) {
        await db
          .update(schema.users)
          .set({ fullName, department } as any)
          .where(eq(schema.users.id, existing.id));
        result.updated++;
      } else {
        // Generate a secure random password — admin must reset before employee can log in
        const tempPassword = await bcrypt.hash(`SAP-${Date.now()}-${Math.random()}`, 10);
        await db.insert(schema.users).values({
          fullName,
          email,
          password: tempPassword,
          department,
          companyId,
          active: false, // Inactive until admin sets up role + resets password
          phoneNumber: undefined,
        } as any);
        result.created++;
      }
      result.synced++;
    } catch (err) {
      result.errors++;
      result.errorDetails.push(`Employee ${emp.EmployeeID}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await db.update(schema.companies).set({ lastSapSyncAt: new Date() } as any).where(eq(schema.companies.id, companyId));

  return result;
}

/**
 * Run a full sync of all entity types for a company.
 */
export async function syncAll(companyId: number): Promise<{
  customers: SyncResult;
  products: SyncResult;
  employees: SyncResult;
}> {
  const [customers, products, employees] = await Promise.all([
    syncCustomers(companyId),
    syncProducts(companyId),
    syncEmployees(companyId),
  ]);
  return { customers, products, employees };
}

// =============================================
// Sale Order Webhook → Draft Gate Pass
// =============================================

/**
 * Process an inbound SAP Sale Order payload and create a draft gate pass.
 *
 * Expected payload shape (SAP can send this via HTTP or via BTP/CIG outbound):
 * {
 *   SalesOrder: "0000012345",
 *   SoldToParty: "1000001",
 *   SoldToPartyName: "ABC Pharma",
 *   RequestedDeliveryDate: "/Date(1700000000000)/",
 *   companyId: 1,
 *   items: [
 *     { Material: "PROD-001", MaterialDescription: "Tablet XYZ", OrderQuantity: "100", OrderQuantityUnit: "EA" }
 *   ]
 * }
 */
export async function processInboundSaleOrder(
  payload: any,
  companyId: number
): Promise<{ gatePassId: number; gatePassNumber: string }> {
  const {
    SalesOrder,
    SoldToParty,
    SoldToPartyName,
    RequestedDeliveryDate,
    items: rawItems = [],
    createdById,       // optional: user ID to attach the gate pass to
  } = payload;

  if (!SalesOrder) throw new Error('SalesOrder number is required');

  // Generate gate pass number from SAP order number
  const gatePassNumber = `SAP-${SalesOrder}`;

  // Check for duplicates
  const [existing] = await db
    .select({ id: schema.gatePasses.id })
    .from(schema.gatePasses)
    .where(eq(schema.gatePasses.gatePassNumber, gatePassNumber))
    .limit(1);

  if (existing) {
    throw new Error(`Gate pass for Sale Order ${SalesOrder} already exists (#${gatePassNumber})`);
  }

  // Resolve customer name — use SoldToPartyName from payload or look up in DB
  const customerName = SoldToPartyName || `BP-${SoldToParty}`;

  // Parse SAP date format /Date(milliseconds)/
  let date = new Date().toISOString().split('T')[0];
  if (RequestedDeliveryDate) {
    const match = String(RequestedDeliveryDate).match(/\/Date\((\d+)\)\//);
    if (match) {
      date = new Date(parseInt(match[1])).toISOString().split('T')[0];
    } else if (/^\d{4}-\d{2}-\d{2}/.test(RequestedDeliveryDate)) {
      date = RequestedDeliveryDate.split('T')[0];
    }
  }

  // Find system admin user to assign as creator if not specified
  let resolvedCreatedById = createdById;
  if (!resolvedCreatedById) {
    const [admin] = await db
      .select({ id: schema.users.id, fullName: schema.users.fullName })
      .from(schema.users)
      .where(eq(schema.users.roleId, 1)) // role 1 = admin
      .limit(1);
    resolvedCreatedById = admin?.id || 1;
  }

  const [creator] = await db
    .select({ fullName: schema.users.fullName })
    .from(schema.users)
    .where(eq(schema.users.id, resolvedCreatedById))
    .limit(1);

  // Insert the gate pass (status = pending, type = outward by default)
  const [gpResult] = await db.insert(schema.gatePasses).values({
    gatePassNumber,
    date,
    companyId,
    customerId: 0,
    customerName,
    deliveryAddress: 'To be confirmed',
    driverId: 0,
    driverName: 'To be assigned',
    driverMobile: '0300-0000000',
    driverCnic: '00000-0000000-0',
    deliveryVanNumber: 'TBA',
    department: 'Logistics',
    notes: `Auto-created from SAP Sale Order ${SalesOrder}`,
    createdBy: creator?.fullName || 'SAP System',
    createdById: resolvedCreatedById,
    status: 'pending',
    type: 'outward',
  } as any);

  const gatePassId = (gpResult as any).insertId;

  // Insert items from sale order
  const items = Array.isArray(rawItems) ? rawItems : [];
  for (const item of items) {
    const name = item.MaterialDescription || item.Material || 'Unknown Item';
    const sku = item.Material || '';
    const quantity = parseInt(item.OrderQuantity || '1', 10);
    await db.insert(schema.items).values({ gatePassId, name, sku, quantity });
  }

  return { gatePassId, gatePassNumber };
}
