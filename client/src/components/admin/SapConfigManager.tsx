import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Settings2, Users, ShoppingBag, Truck, Zap } from "lucide-react";

interface Company {
  id: number;
  name: string;
  shortName: string | null;
}

interface SapConfig {
  enabled: boolean;
  baseUrl: string;
  username: string;
  password: string;
  clientId: string;
}

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: number;
  errorDetails: string[];
  message: string;
}

async function fetchCompanies(): Promise<Company[]> {
  const res = await fetch("/api/companies");
  if (!res.ok) throw new Error("Failed to fetch companies");
  return res.json();
}

async function fetchSapConfig(companyId: number): Promise<SapConfig> {
  const res = await fetch(`/api/sap/config/${companyId}`);
  if (!res.ok) throw new Error("Failed to fetch SAP config");
  return res.json();
}

const defaultConfig: SapConfig = {
  enabled: false,
  baseUrl: "",
  username: "",
  password: "",
  clientId: "100",
};

export function SapConfigManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [form, setForm] = useState<SapConfig>(defaultConfig);
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult | null>>({});

  const { data: companies = [], isLoading: loadingCompanies } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const { data: sapConfig, isLoading: loadingConfig } = useQuery<SapConfig>({
    queryKey: ["sapConfig", selectedCompanyId],
    queryFn: () => fetchSapConfig(selectedCompanyId!),
    enabled: selectedCompanyId !== null,
  });

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    if (sapConfig) {
      setForm({ ...sapConfig, password: "" }); // never pre-fill password
    }
  }, [sapConfig]);

  // Save config
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sap/config/${selectedCompanyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sapConfig", selectedCompanyId] });
      toast({ title: "Saved", description: data.message });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Test connection
  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sap/test/${selectedCompanyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Connection Successful" : "Connection Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: () => toast({ title: "Test Failed", description: "Could not reach SAP system", variant: "destructive" }),
  });

  // Generic sync trigger
  const triggerSync = async (entity: "customers" | "products" | "employees" | "all") => {
    const url = entity === "all"
      ? `/api/sap/sync/${selectedCompanyId}`
      : `/api/sap/sync/${selectedCompanyId}/${entity}`;

    setSyncResults((prev) => ({ ...prev, [entity]: null }));
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      if (entity === "all") {
        setSyncResults({
          customers: data.customers,
          products: data.products,
          employees: data.employees,
        });
      } else {
        setSyncResults((prev) => ({ ...prev, [entity]: data }));
      }
      toast({ title: "Sync Complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    } catch (err) {
      toast({ title: "Sync Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  if (loadingCompanies) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No companies found. Add a company first before configuring SAP.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Selector */}
      {companies.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {companies.map((c) => (
            <Button
              key={c.id}
              variant={selectedCompanyId === c.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCompanyId(c.id)}
            >
              {c.shortName || c.name}
            </Button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Settings2 className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-semibold">
          SAP Integration — {selectedCompany?.name}
        </h2>
        {sapConfig?.enabled && (
          <Badge className="bg-green-100 text-green-700 border-green-300">Active</Badge>
        )}
        {sapConfig && !sapConfig.enabled && (
          <Badge variant="secondary">Disabled</Badge>
        )}
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="sync">Data Sync</TabsTrigger>
        </TabsList>

        {/* ── Config Tab ── */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>SAP System Configuration</CardTitle>
              <CardDescription>
                Connect to your SAP ECC or S4HANA system via OData REST APIs.
                Credentials are stored securely on the server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingConfig ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <>
                  {/* Enable toggle */}
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Enable SAP Integration</p>
                      <p className="text-sm text-muted-foreground">
                        When enabled, manual creation of customers and drivers is disabled
                        and data is sourced from SAP.
                      </p>
                    </div>
                    <Switch
                      checked={form.enabled}
                      onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-1">
                      <Label>SAP System Base URL</Label>
                      <Input
                        placeholder="https://my-sap.example.com"
                        value={form.baseUrl}
                        onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Root URL of your SAP system (no trailing slash)
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label>Username</Label>
                      <Input
                        placeholder="SAPUSER"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        placeholder={sapConfig?.password ? "••••••••  (leave blank to keep)" : "Enter password"}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Client / Mandant</Label>
                      <Input
                        placeholder="100"
                        maxLength={3}
                        value={form.clientId}
                        onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">3-digit SAP client number</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => testMutation.mutate()}
                      disabled={testMutation.isPending || !form.baseUrl}
                    >
                      {testMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                      Test Connection
                    </Button>
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      Save Configuration
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sync Tab ── */}
        <TabsContent value="sync">
          <div className="space-y-4">
            {!sapConfig?.enabled && (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  SAP integration is currently disabled. Enable it in the Configuration tab first.
                </p>
              </div>
            )}

            {/* Full sync */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-600" /> Full Sync
                </CardTitle>
                <CardDescription>Sync all entities (customers, products, employees) in one operation.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => triggerSync("all")}
                  disabled={!sapConfig?.enabled}
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Run Full Sync
                </Button>
              </CardContent>
            </Card>

            {/* Individual sync cards */}
            {(
              [
                { key: "customers", label: "Customers", desc: "SAP Business Partners → Customers table", icon: Users },
                { key: "products", label: "Products / Materials", desc: "SAP Materials → Products catalog", icon: ShoppingBag },
                { key: "employees", label: "Employees", desc: "SAP HCM Employees → Users (imported as inactive)", icon: Truck },
              ] as const
            ).map(({ key, label, desc, icon: Icon }) => {
              const r = syncResults[key];
              return (
                <Card key={key}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-4 w-4 text-blue-600" /> {label}
                    </CardTitle>
                    <CardDescription>{desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerSync(key)}
                      disabled={!sapConfig?.enabled}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" /> Sync {label}
                    </Button>

                    {r && (
                      <div className={`p-3 rounded-md border text-sm ${r.errors > 0 ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}`}>
                        <div className="flex items-center gap-2 font-medium mb-1">
                          {r.errors > 0 ? (
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          {r.message}
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Total: <strong>{r.synced}</strong></span>
                          <span>New: <strong>{r.created}</strong></span>
                          <span>Updated: <strong>{r.updated}</strong></span>
                          {r.errors > 0 && <span className="text-amber-700">Errors: <strong>{r.errors}</strong></span>}
                        </div>
                        {r.errorDetails.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-amber-700">View errors ({r.errorDetails.length})</summary>
                            <ul className="mt-1 space-y-1">
                              {r.errorDetails.map((e, i) => (
                                <li key={i} className="text-xs text-amber-800 font-mono">• {e}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
