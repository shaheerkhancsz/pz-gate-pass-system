import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Upload, Building2, Phone, Image, Palette } from "lucide-react";

interface Company {
  id: number;
  name: string;
  code?: string;
  fullName?: string;
  tagline?: string;
  shortName?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  footerText?: string;
  logo?: string;
  active?: boolean;
}

interface ThemeData {
  variant: string;
  primary: string;
  appearance: string;
  radius: number;
}

// ── Helper: hex → HSL string for CSS variable (format: "H S% L%")
function hexToHslString(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const companyFormSchema = z.object({
  name: z.string().min(2, "Company name is required"),
  code: z.string().max(10, "Max 10 characters").optional(),
  fullName: z.string().optional(),
  tagline: z.string().optional(),
  shortName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email("Invalid email address"), z.literal("")]).optional(),
  website: z.string().optional(),
  footerText: z.string().optional(),
});

const colorFormSchema = z.object({
  primary: z.string().regex(/^#([A-Fa-f0-9]{6})$/, "Enter a valid hex color (e.g. #003087)"),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;
type ColorFormValues = z.infer<typeof colorFormSchema>;

export default function CompanySettings() {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    user?.companyId ?? null
  );

  // Fetch all companies for admin selector
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: () => fetch("/api/companies", { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
  });

  // Auto-select first active company for admins with no companyId
  useEffect(() => {
    if (isAdmin && selectedCompanyId === null && companies.length > 0) {
      const active = companies.find(c => c.active !== false) ?? companies[0];
      setSelectedCompanyId(active.id);
    }
  }, [isAdmin, companies, selectedCompanyId]);

  const effectiveId = isAdmin ? selectedCompanyId : (user?.companyId ?? null);

  // Fetch selected company from DB
  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ["companies", effectiveId],
    queryFn: () =>
      fetch(`/api/companies/${effectiveId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!effectiveId,
  });

  // Fetch current theme
  const { data: theme } = useQuery<ThemeData>({
    queryKey: ["theme"],
    queryFn: () => fetch("/api/theme", { credentials: "include" }).then(r => r.json()),
  });

  // Company info form
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "", code: "", fullName: "", tagline: "", shortName: "",
      address: "", phone: "", email: "", website: "", footerText: "",
    },
    values: company
      ? {
          name: company.name ?? "",
          code: company.code ?? "",
          fullName: company.fullName ?? "",
          tagline: company.tagline ?? "",
          shortName: company.shortName ?? "",
          address: company.address ?? "",
          phone: company.phone ?? "",
          email: company.email ?? "",
          website: company.website ?? "",
          footerText: company.footerText ?? "",
        }
      : undefined,
  });

  // Color form
  const colorForm = useForm<ColorFormValues>({
    resolver: zodResolver(colorFormSchema),
    defaultValues: { primary: "#003087" },
    values: theme ? { primary: theme.primary } : undefined,
  });

  // Reset logo preview on company switch
  useEffect(() => {
    setLogoPreview(null);
    setLogoBase64(null);
  }, [effectiveId]);

  // ── Save company info ──
  const updateMutation = useMutation({
    mutationFn: (payload: CompanyFormValues & { logo?: string }) =>
      fetch(`/api/companies/${effectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }).then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.message || "Failed to update company");
        return json;
      }),
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Company information updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setLogoBase64(null);
      setLogoPreview(null);
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Save theme color ──
  const themeMutation = useMutation({
    mutationFn: (data: ColorFormValues) =>
      fetch("/api/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ primary: data.primary }),
      }).then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.message || "Failed to update theme");
        return json;
      }),
    onSuccess: (_, variables) => {
      // Apply immediately to current page via CSS variable
      try {
        document.documentElement.style.setProperty("--primary", hexToHslString(variables.primary));
      } catch { /* ignore */ }
      toast({
        title: "Color updated",
        description: "Primary color saved. Reload the page to see the full effect across all elements.",
      });
      queryClient.invalidateQueries({ queryKey: ["theme"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function onSubmit(data: CompanyFormValues) {
    const payload: CompanyFormValues & { logo?: string } = { ...data };
    if (logoBase64) payload.logo = logoBase64;
    updateMutation.mutate(payload);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 500 KB.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setLogoPreview(result);
      setLogoBase64(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 max-w-3xl">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Company Settings</h1>

        {/* Company selector — admin only */}
        {isAdmin && companies.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {companies.map(c => (
              <Button
                key={c.id}
                variant={selectedCompanyId === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCompanyId(c.id)}
                className={selectedCompanyId === c.id ? "bg-primary text-white" : ""}
              >
                {c.shortName || c.name}
              </Button>
            ))}
          </div>
        )}

        {!effectiveId ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No company assigned to your account.</p>
              <p className="text-sm mt-1">Contact your administrator to assign a company.</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Configure Company Information</CardTitle>
              {company && (
                <p className="text-sm text-muted-foreground">
                  Editing: <span className="font-medium text-foreground">{company.name}</span>
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto pb-1">
                <Tabs defaultValue="general">
                  <TabsList className="mb-6 flex flex-nowrap w-max">
                    <TabsTrigger value="general" className="gap-1.5">
                      <Building2 className="h-4 w-4" /> General
                    </TabsTrigger>
                    <TabsTrigger value="contact" className="gap-1.5">
                      <Phone className="h-4 w-4" /> Contact
                    </TabsTrigger>
                    <TabsTrigger value="branding" className="gap-1.5">
                      <Palette className="h-4 w-4" /> Branding
                    </TabsTrigger>
                    <TabsTrigger value="logo" className="gap-1.5">
                      <Image className="h-4 w-4" /> Logo
                    </TabsTrigger>
                  </TabsList>

                  {/* ── General Tab ── */}
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                      <TabsContent value="general">
                        <div className="grid gap-4 py-2">
                          <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name *</FormLabel>
                              <FormControl><Input {...field} placeholder="e.g. AGP Pharma" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="fullName" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Legal Name</FormLabel>
                              <FormControl><Input {...field} placeholder="e.g. AGP Pharma Private Limited" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <FormField control={form.control} name="shortName" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Short Name</FormLabel>
                                <FormControl><Input {...field} placeholder="e.g. AGP" /></FormControl>
                                <FormMessage />
                                <p className="text-xs text-muted-foreground">Used in company selector buttons.</p>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="code" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Gate Pass Prefix</FormLabel>
                                <FormControl><Input {...field} placeholder="e.g. AGP" maxLength={10} className="uppercase" onChange={e => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                                <FormMessage />
                                <p className="text-xs text-muted-foreground">Company code used in gate pass numbers (e.g. OWNR-AG01-IS-2026-0001).</p>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="tagline" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tagline</FormLabel>
                                <FormControl><Input {...field} placeholder="e.g. We Value Life" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          <FormField control={form.control} name="footerText" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Footer Text</FormLabel>
                              <FormControl><Input {...field} placeholder="e.g. © 2025 AGP Pharma Private Limited. All rights reserved." /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </TabsContent>

                      {/* ── Contact Tab ── */}
                      <TabsContent value="contact">
                        <div className="grid gap-4 py-2">
                          <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address</FormLabel>
                              <FormControl><Input {...field} placeholder="Company address" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="phone" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl><Input {...field} placeholder="+92-XXX-XXXXXXX" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl><Input {...field} type="email" placeholder="info@company.com" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          <FormField control={form.control} name="website" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Website</FormLabel>
                              <FormControl><Input {...field} placeholder="e.g. www.agppharma.com" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </TabsContent>

                      {/* ── Logo Tab ── */}
                      <TabsContent value="logo">
                        <div className="py-2 space-y-6">
                          <div className="border rounded-lg p-6 flex flex-col items-center gap-3">
                            <p className="text-sm font-medium">Current Logo</p>
                            <div className="bg-gray-100 p-4 rounded-lg flex items-center justify-center min-h-[100px]">
                              <img
                                src={logoPreview ?? (company?.logo && (company.logo.startsWith("data:") || company.logo.startsWith("http")) ? company.logo : "/assets/AGP-logo.png")}
                                alt="Company logo"
                                className="max-h-20 max-w-[240px] object-contain"
                              />
                            </div>
                            {logoPreview && (
                              <p className="text-xs text-amber-600 font-medium">
                                Preview — click Save Changes to apply.
                              </p>
                            )}
                          </div>
                          <div className="border rounded-lg p-6 space-y-3">
                            <p className="text-sm font-medium">Upload New Logo</p>
                            <p className="text-xs text-muted-foreground">
                              Accepted formats: PNG, JPG, GIF, SVG. Maximum size: 500 KB.
                            </p>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/gif,image/svg+xml"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                            <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="h-4 w-4 mr-2" /> Choose File
                              </Button>
                              {logoPreview && (
                                <Button
                                  type="button" variant="ghost" size="sm" className="text-muted-foreground"
                                  onClick={() => {
                                    setLogoPreview(null); setLogoBase64(null);
                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                  }}
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      {/* Action buttons for General / Contact / Logo tabs */}
                      <TabsContent value="general">
                        <div className="flex justify-end mt-6 gap-2">
                          <Button type="button" variant="outline" onClick={() => form.reset()} disabled={updateMutation.isPending}>Reset</Button>
                          <Button type="submit" disabled={updateMutation.isPending} className="bg-primary text-white">
                            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Changes
                          </Button>
                        </div>
                      </TabsContent>
                      <TabsContent value="contact">
                        <div className="flex justify-end mt-6 gap-2">
                          <Button type="button" variant="outline" onClick={() => form.reset()} disabled={updateMutation.isPending}>Reset</Button>
                          <Button type="submit" disabled={updateMutation.isPending} className="bg-primary text-white">
                            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Changes
                          </Button>
                        </div>
                      </TabsContent>
                      <TabsContent value="logo">
                        <div className="flex justify-end mt-6 gap-2">
                          <Button type="button" variant="outline" onClick={() => { form.reset(); setLogoPreview(null); setLogoBase64(null); }} disabled={updateMutation.isPending}>Reset</Button>
                          <Button type="submit" disabled={updateMutation.isPending} className="bg-primary text-white">
                            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Changes
                          </Button>
                        </div>
                      </TabsContent>
                    </form>
                  </Form>

                  {/* ── Branding Tab — separate form ── */}
                  <TabsContent value="branding">
                    <Form {...colorForm}>
                      <form onSubmit={colorForm.handleSubmit(v => themeMutation.mutate(v))}>
                        <div className="grid gap-6 py-2">
                          <FormField
                            control={colorForm.control}
                            name="primary"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Primary Color</FormLabel>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="color"
                                    value={field.value}
                                    onChange={e => field.onChange(e.target.value)}
                                    className="h-10 w-14 rounded border cursor-pointer p-0.5"
                                  />
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="#003087"
                                      className="w-36 font-mono"
                                    />
                                  </FormControl>
                                  <div
                                    className="h-10 w-10 rounded-md border shadow-sm flex-shrink-0"
                                    style={{ backgroundColor: field.value }}
                                  />
                                </div>
                                <FormMessage />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Controls the sidebar, buttons, and accent colors throughout the app. Changes are saved to the server and applied immediately. A full page reload may be needed for all elements to update.
                                </p>
                              </FormItem>
                            )}
                          />

                          {/* Live preview */}
                          <div className="border rounded-lg p-4 space-y-2">
                            <p className="text-sm font-medium mb-3">Live Preview</p>
                            <div className="flex flex-wrap gap-2">
                              <div className="px-4 py-2 rounded text-white text-sm font-medium" style={{ backgroundColor: colorForm.watch("primary") }}>
                                Primary Button
                              </div>
                              <div className="px-4 py-2 rounded text-sm font-medium border-2" style={{ color: colorForm.watch("primary"), borderColor: colorForm.watch("primary") }}>
                                Outline Button
                              </div>
                              <div className="px-3 py-1 rounded-full text-white text-xs font-medium" style={{ backgroundColor: colorForm.watch("primary") }}>
                                Badge
                              </div>
                            </div>
                            <div className="mt-3 h-8 rounded" style={{ backgroundColor: colorForm.watch("primary") }} />
                          </div>
                        </div>

                        <div className="flex justify-end mt-6 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => colorForm.reset()}
                            disabled={themeMutation.isPending}
                          >
                            Reset
                          </Button>
                          <Button
                            type="submit"
                            disabled={themeMutation.isPending}
                            className="bg-primary text-white"
                          >
                            {themeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Apply Color
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
