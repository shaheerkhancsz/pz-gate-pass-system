import { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/layout/AppLayout';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import {
  Mail, MessageSquare, Loader2, Send, Bell,
  CheckCircle2, XCircle, Smartphone,
} from 'lucide-react';

// ── Validation ──────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  email: z.object({
    enabled: z.boolean().default(false),
    host: z.string().optional(),
    port: z.coerce.number().int().optional(),
    secure: z.boolean().default(false),
    user: z.string().optional(),
    password: z.string().optional(),
  }),
  sms: z.object({
    enabled: z.boolean().default(false),
    accountSid: z.string().optional(),
    authToken: z.string().optional(),
    phoneNumber: z.string().optional(),
  }),
  whatsapp: z.object({
    enabled: z.boolean().default(false),
    phoneNumberId: z.string().optional(),
    accessToken: z.string().optional(),
    testNumber: z.string().optional(),
  }),
});

type SettingsValues = z.infer<typeof settingsSchema>;

interface SettingsResponse {
  email: { enabled: boolean; host: string; port: number; secure: boolean; user: string; password: string };
  sms: { enabled: boolean; accountSid: string; authToken: string; phoneNumber: string };
  whatsapp: { enabled: boolean; phoneNumberId: string; accessToken: string };
}

// ── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ enabled }: { enabled: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ml-1.5 ${enabled ? 'bg-green-500' : 'bg-slate-300'}`} />
  );
}

// ── Channel status badge ─────────────────────────────────────────────────────

function ChannelBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge className="bg-green-100 text-green-800 border-green-200 gap-1 text-xs font-medium px-2">
      <CheckCircle2 className="h-3 w-3" /> Active
    </Badge>
  ) : (
    <Badge variant="outline" className="text-slate-400 gap-1 text-xs font-medium px-2">
      <XCircle className="h-3 w-3" /> Inactive
    </Badge>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NotificationSettings() {
  const { toast } = useToast();

  // Fetch settings
  const { data: settings, isLoading } = useQuery<SettingsResponse>({
    queryKey: ['/api/settings/notifications'],
    queryFn: async () => {
      const res = await fetch('/api/settings/notifications', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  // Form
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      email: { enabled: false, host: '', port: 587, secure: false, user: '', password: '' },
      sms: { enabled: false, accountSid: '', authToken: '', phoneNumber: '' },
      whatsapp: { enabled: false, phoneNumberId: '', accessToken: '', testNumber: '' },
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        email: {
          enabled: settings.email.enabled,
          host: settings.email.host,
          port: settings.email.port,
          secure: settings.email.secure,
          user: settings.email.user,
          password: settings.email.password,
        },
        sms: {
          enabled: settings.sms.enabled,
          accountSid: settings.sms.accountSid,
          authToken: settings.sms.authToken,
          phoneNumber: settings.sms.phoneNumber,
        },
        whatsapp: {
          enabled: settings.whatsapp?.enabled ?? false,
          phoneNumberId: settings.whatsapp?.phoneNumberId ?? '',
          accessToken: settings.whatsapp?.accessToken ?? '',
          testNumber: '',
        },
      });
    }
  }, [settings, form]);

  // Watch enabled flags for live status dots and disabled state
  const emailEnabled   = useWatch({ control: form.control, name: 'email.enabled' });
  const smsEnabled     = useWatch({ control: form.control, name: 'sms.enabled' });
  const whatsappEnabled = useWatch({ control: form.control, name: 'whatsapp.enabled' });

  // Save
  const saveMutation = useMutation({
    mutationFn: async (data: SettingsValues) => {
      const res = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/notifications'] });
      toast({ title: 'Settings saved', description: 'Notification settings saved successfully.' });
    },
    onError: (err) => {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    },
  });

  // Test email
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form.getValues('email')),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed'); }
      return res.json();
    },
    onSuccess: (d) => toast({ title: 'Email test sent', description: d.message || 'Test email sent successfully.' }),
    onError: (e) => toast({ title: 'Email test failed', description: e instanceof Error ? e.message : 'Check your SMTP settings.', variant: 'destructive' }),
  });

  // Test SMS
  const testSmsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form.getValues('sms')),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed'); }
      return res.json();
    },
    onSuccess: () => toast({ title: 'SMS sent', description: 'Test SMS sent successfully.' }),
    onError: (e) => toast({ title: 'SMS test failed', description: e instanceof Error ? e.message : 'Check your Twilio settings.', variant: 'destructive' }),
  });

  // Test WhatsApp
  const testWaMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form.getValues('whatsapp')),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed'); }
      return res.json();
    },
    onSuccess: (d) => toast({ title: 'WhatsApp message sent', description: d.message || 'Test message sent.' }),
    onError: (e) => toast({ title: 'WhatsApp test failed', description: e instanceof Error ? e.message : 'Check your credentials.', variant: 'destructive' }),
  });

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notification Settings</h1>
            <p className="text-sm text-muted-foreground">Configure email, SMS, and WhatsApp notification channels</p>
          </div>
        </div>

        {/* Channel status summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Email',     icon: Mail,           enabled: emailEnabled,    desc: 'SMTP / Nodemailer' },
            { label: 'SMS',       icon: Smartphone,     enabled: smsEnabled,      desc: 'Twilio' },
            { label: 'WhatsApp',  icon: MessageSquare,  enabled: whatsappEnabled, desc: 'Meta Business API' },
          ].map(({ label, icon: Icon, enabled, desc }) => (
            <Card key={label} className={`transition-colors ${enabled ? 'border-green-200 bg-green-50/40' : ''}`}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`p-2 rounded-lg ${enabled ? 'bg-green-100' : 'bg-muted'}`}>
                  <Icon className={`h-5 w-5 ${enabled ? 'text-green-700' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{label}</span>
                    <ChannelBadge enabled={enabled} />
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading settings...</span>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => saveMutation.mutate(d))} className="space-y-6">
              <Tabs defaultValue="email">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="email" className="gap-1.5">
                    <Mail className="h-4 w-4" /> Email <StatusDot enabled={emailEnabled} />
                  </TabsTrigger>
                  <TabsTrigger value="sms" className="gap-1.5">
                    <Smartphone className="h-4 w-4" /> SMS <StatusDot enabled={smsEnabled} />
                  </TabsTrigger>
                  <TabsTrigger value="whatsapp" className="gap-1.5">
                    <MessageSquare className="h-4 w-4" /> WhatsApp <StatusDot enabled={whatsappEnabled} />
                  </TabsTrigger>
                </TabsList>

                {/* ── Email ── */}
                <TabsContent value="email">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-primary" /> Email Notifications
                          </CardTitle>
                          <CardDescription className="mt-1">
                            SMTP configuration for sending email alerts on gate pass events
                          </CardDescription>
                        </div>
                        <ChannelBadge enabled={emailEnabled} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <FormField
                        control={form.control} name="email.enabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                            <div>
                              <FormLabel className="text-base font-medium">Enable Email Notifications</FormLabel>
                              <FormDescription>Send email alerts when gate passes are created, approved, or rejected</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )}
                      />

                      <Separator />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control} name="email.host"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Host</FormLabel>
                              <FormControl><Input placeholder="smtp.gmail.com" {...field} disabled={!emailEnabled} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control} name="email.port"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Port</FormLabel>
                              <FormControl><Input type="number" placeholder="587" {...field} disabled={!emailEnabled} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control} name="email.secure"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div>
                              <FormLabel className="text-base font-medium">SSL/TLS Encryption</FormLabel>
                              <FormDescription>Enable for port 465; leave off for port 587 (STARTTLS)</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!emailEnabled} /></FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control} name="email.user"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Username</FormLabel>
                              <FormControl><Input placeholder="notifications@yourcompany.com" {...field} disabled={!emailEnabled} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control} name="email.password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Password</FormLabel>
                              <FormControl><Input type="password" placeholder="●●●●●●●●" {...field} disabled={!emailEnabled} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          type="button" variant="outline" size="sm"
                          disabled={!emailEnabled || testEmailMutation.isPending}
                          onClick={() => testEmailMutation.mutate()}
                        >
                          {testEmailMutation.isPending
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Testing...</>
                            : <><Send className="h-4 w-4 mr-2" />Send Test Email</>}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── SMS ── */}
                <TabsContent value="sms">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Smartphone className="h-5 w-5 text-primary" /> SMS Notifications
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Twilio credentials for sending SMS alerts
                          </CardDescription>
                        </div>
                        <ChannelBadge enabled={smsEnabled} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <FormField
                        control={form.control} name="sms.enabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                            <div>
                              <FormLabel className="text-base font-medium">Enable SMS Notifications</FormLabel>
                              <FormDescription>Send SMS alerts to users with phone numbers in their profiles</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )}
                      />

                      <Separator />

                      <FormField
                        control={form.control} name="sms.accountSid"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Twilio Account SID</FormLabel>
                            <FormControl><Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...field} disabled={!smsEnabled} /></FormControl>
                            <FormDescription>Found in your Twilio Console dashboard</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control} name="sms.authToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Auth Token</FormLabel>
                            <FormControl><Input type="password" placeholder="●●●●●●●●" {...field} disabled={!smsEnabled} /></FormControl>
                            <FormDescription>Your Twilio account auth token — keep this secret</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control} name="sms.phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Twilio Phone Number</FormLabel>
                            <FormControl><Input placeholder="+12015551234" {...field} disabled={!smsEnabled} /></FormControl>
                            <FormDescription>The Twilio number to send messages from (E.164 format)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end pt-2">
                        <Button
                          type="button" variant="outline" size="sm"
                          disabled={!smsEnabled || testSmsMutation.isPending}
                          onClick={() => testSmsMutation.mutate()}
                        >
                          {testSmsMutation.isPending
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                            : <><Send className="h-4 w-4 mr-2" />Send Test SMS</>}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── WhatsApp ── */}
                <TabsContent value="whatsapp">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-primary" /> WhatsApp Notifications
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Meta WhatsApp Business API — obtain credentials from the{' '}
                            <span className="font-medium text-foreground">Meta for Developers</span> portal
                          </CardDescription>
                        </div>
                        <ChannelBadge enabled={whatsappEnabled} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <FormField
                        control={form.control} name="whatsapp.enabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                            <div>
                              <FormLabel className="text-base font-medium">Enable WhatsApp Notifications</FormLabel>
                              <FormDescription>Send workflow alerts via WhatsApp to users with phone numbers set</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )}
                      />

                      <Separator />

                      <FormField
                        control={form.control} name="whatsapp.phoneNumberId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number ID</FormLabel>
                            <FormControl><Input placeholder="123456789012345" {...field} disabled={!whatsappEnabled} /></FormControl>
                            <FormDescription>WhatsApp → API Setup in your Meta App Dashboard</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control} name="whatsapp.accessToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Access Token</FormLabel>
                            <FormControl><Input type="password" placeholder="●●●●●●●●" {...field} disabled={!whatsappEnabled} /></FormControl>
                            <FormDescription>Use a permanent System User token for production</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control} name="whatsapp.testNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Test Recipient Number</FormLabel>
                            <FormControl><Input placeholder="03001234567" {...field} disabled={!whatsappEnabled} /></FormControl>
                            <FormDescription>Pakistani format (e.g. 03001234567) — must have opted in to receive messages</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end pt-2">
                        <Button
                          type="button" variant="outline" size="sm"
                          disabled={!whatsappEnabled || testWaMutation.isPending}
                          onClick={() => testWaMutation.mutate()}
                        >
                          {testWaMutation.isPending
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                            : <><Send className="h-4 w-4 mr-2" />Send Test Message</>}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saveMutation.isPending || !form.formState.isDirty}
                  className="min-w-[140px]"
                >
                  {saveMutation.isPending
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                    : 'Save Settings'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </AppLayout>
  );
}
