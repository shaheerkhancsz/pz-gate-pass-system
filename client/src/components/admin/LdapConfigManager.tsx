import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, Zap, Settings2 } from "lucide-react";

interface Company {
  id: number;
  name: string;
  shortName: string | null;
}

interface LdapConfig {
  enabled: boolean;
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  searchBase: string;
  usernameAttr: string;
  emailAttr: string;
  displayNameAttr: string;
  departmentAttr: string;
  phoneAttr: string;
}

const defaultConfig: LdapConfig = {
  enabled: false,
  url: "",
  baseDn: "",
  bindDn: "",
  bindPassword: "",
  searchBase: "",
  usernameAttr: "sAMAccountName",
  emailAttr: "mail",
  displayNameAttr: "displayName",
  departmentAttr: "department",
  phoneAttr: "telephoneNumber",
};

async function fetchCompanies(): Promise<Company[]> {
  const res = await fetch("/api/companies");
  if (!res.ok) throw new Error("Failed to fetch companies");
  return res.json();
}

async function fetchLdapConfig(companyId: number): Promise<LdapConfig> {
  const res = await fetch(`/api/companies/${companyId}/ldap-config`);
  if (!res.ok) throw new Error("Failed to fetch LDAP config");
  return res.json();
}

export function LdapConfigManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [form, setForm] = useState<LdapConfig>(defaultConfig);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: companies = [], isLoading: loadingCompanies } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const { data: ldapConfig, isLoading: loadingConfig } = useQuery<LdapConfig>({
    queryKey: ["ldapConfig", selectedCompanyId],
    queryFn: () => fetchLdapConfig(selectedCompanyId!),
    enabled: selectedCompanyId !== null,
  });

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    if (ldapConfig) {
      setForm({ ...ldapConfig, bindPassword: "" }); // never pre-fill password
    }
  }, [ldapConfig]);

  // Save config
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/companies/${selectedCompanyId}/ldap-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ldapConfig", selectedCompanyId] });
      toast({ title: "Saved", description: data.message });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Test connection
  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/companies/${selectedCompanyId}/ldap-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      toast({
        title: data.success ? "Connection Successful" : "Connection Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: () => {
      setTestResult({ success: false, message: "Could not reach LDAP server" });
      toast({ title: "Test Failed", description: "Could not reach LDAP server", variant: "destructive" });
    },
  });

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  if (loadingCompanies) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No companies found. Add a company first before configuring AD/LDAP.</p>
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
              onClick={() => { setSelectedCompanyId(c.id); setTestResult(null); }}
            >
              {c.shortName || c.name}
            </Button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-semibold">
          Active Directory / LDAP — {selectedCompany?.name}
        </h2>
        {ldapConfig?.enabled && (
          <Badge className="bg-green-100 text-green-700 border-green-300">Active</Badge>
        )}
        {ldapConfig && !ldapConfig.enabled && (
          <Badge variant="secondary">Disabled</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>LDAP / Active Directory Configuration</CardTitle>
          <CardDescription>
            Allow employees to log in with their existing Windows / AD network credentials.
            When enabled, users can choose "AD Login" on the login page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingConfig ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* Enable toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Enable AD / LDAP Login</p>
                  <p className="text-sm text-muted-foreground">
                    Shows the "Windows Login" option on the login page for this company's users.
                  </p>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                />
              </div>

              {/* Server settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <Label>LDAP Server URL</Label>
                  <Input
                    placeholder="ldap://192.168.1.10:389  or  ldaps://ad.agp.com:636"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use <code>ldap://</code> for plain LDAP (port 389) or <code>ldaps://</code> for TLS (port 636).
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Base DN</Label>
                  <Input
                    placeholder="DC=agp,DC=com"
                    value={form.baseDn}
                    onChange={(e) => setForm({ ...form, baseDn: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Root distinguished name of your domain</p>
                </div>

                <div className="space-y-1">
                  <Label>User Search Base</Label>
                  <Input
                    placeholder="OU=Users,DC=agp,DC=com"
                    value={form.searchBase}
                    onChange={(e) => setForm({ ...form, searchBase: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">OU where user accounts are stored</p>
                </div>

                <div className="space-y-1">
                  <Label>Bind DN (Service Account)</Label>
                  <Input
                    placeholder="CN=svc-gatepass,OU=ServiceAccounts,DC=agp,DC=com"
                    value={form.bindDn}
                    onChange={(e) => setForm({ ...form, bindDn: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Read-only service account used to search the directory</p>
                </div>

                <div className="space-y-1">
                  <Label>Bind Password</Label>
                  <Input
                    type="password"
                    placeholder={ldapConfig?.bindPassword ? "••••••••  (leave blank to keep)" : "Enter password"}
                    value={form.bindPassword}
                    onChange={(e) => setForm({ ...form, bindPassword: e.target.value })}
                  />
                </div>
              </div>

              {/* Attribute mapping */}
              <div>
                <p className="text-sm font-medium mb-3">Attribute Mapping</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { key: "usernameAttr", label: "Username Attribute", placeholder: "sAMAccountName" },
                    { key: "emailAttr",    label: "Email Attribute",    placeholder: "mail" },
                    { key: "displayNameAttr", label: "Full Name Attribute", placeholder: "displayName" },
                    { key: "departmentAttr",  label: "Department Attribute", placeholder: "department" },
                    { key: "phoneAttr",       label: "Phone Attribute",     placeholder: "telephoneNumber" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <Label>{label}</Label>
                      <Input
                        placeholder={placeholder}
                        value={(form as any)[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Test result banner */}
              {testResult && (
                <div
                  className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                    testResult.success
                      ? "border-green-300 bg-green-50 text-green-800"
                      : "border-red-300 bg-red-50 text-red-800"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                  )}
                  {testResult.message}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => { setTestResult(null); testMutation.mutate(); }}
                  disabled={testMutation.isPending || !form.url || !form.searchBase}
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-1" />
                  )}
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

              {/* How it works note */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 space-y-1">
                <p className="font-medium">How AD Login works</p>
                <ul className="list-disc ml-4 space-y-0.5 text-blue-700">
                  <li>Users select "Windows / AD Login" on the login page and enter their Windows username &amp; password.</li>
                  <li>The server authenticates against your AD server using the service account configured above.</li>
                  <li>On first login, a local account is automatically created using attributes from Active Directory.</li>
                  <li>Profile attributes (name, department, phone) are refreshed from AD on every subsequent login.</li>
                  <li>Admin and super-admin accounts always retain the standard email/password fallback.</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
