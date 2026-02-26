import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

// Validation schema for email settings
const emailSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  host: z.string().optional(),
  port: z.coerce.number().int().optional(),
  secure: z.boolean().default(false),
  user: z.string().optional(),
  password: z.string().optional(),
});

// Validation schema for SMS settings
const smsSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  accountSid: z.string().min(1, 'Account SID is required'),
  authToken: z.string().min(1, 'Auth Token is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
});

// Validation schema for WhatsApp settings
const whatsappSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  phoneNumberId: z.string().optional(),
  accessToken: z.string().optional(),
  testNumber: z.string().optional(),
});

// Combined schema
const settingsSchema = z.object({
  email: emailSettingsSchema,
  sms: smsSettingsSchema,
  whatsapp: whatsappSettingsSchema,
});

type NotificationSettingsValues = z.infer<typeof settingsSchema>;

interface NotificationSettingsResponse {
  email: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
  sms: {
    enabled: boolean;
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  whatsapp: {
    enabled: boolean;
    phoneNumberId: string;
    accessToken: string;
  };
}

export default function NotificationSettings() {
  const [activeTab, setActiveTab] = useState('email');
  const { toast } = useToast();

  const defaultSettings: NotificationSettingsResponse = {
    email: { enabled: false, host: '', port: 587, secure: false, user: '', password: '' },
    sms: { enabled: false, accountSid: '', authToken: '', phoneNumber: '' },
    whatsapp: { enabled: false, phoneNumberId: '', accessToken: '' },
  };

  // Fetch settings
  const { data: settings, isLoading } = useQuery<NotificationSettingsResponse>({
    queryKey: ['/api/settings/notifications'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/settings/notifications');
        if (!response.ok) throw new Error('Failed to fetch notification settings');
        return await response.json() as NotificationSettingsResponse;
      } catch (error) {
        console.error('Error fetching notification settings:', error);
        return defaultSettings;
      }
    },
  });

  // Form setup
  const form = useForm<NotificationSettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      email: { enabled: false, host: '', port: 587, secure: false, user: '', password: '' },
      sms: { enabled: false, accountSid: '', authToken: '', phoneNumber: '' },
      whatsapp: { enabled: false, phoneNumberId: '', accessToken: '', testNumber: '' },
    },
  });

  // Update form values when settings are loaded
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

  // Save settings
  const saveMutation = useMutation({
    mutationFn: async (data: NotificationSettingsValues) => {
      const response = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save notification settings');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/notifications'] });
      toast({ title: 'Settings saved', description: data.message || 'Notification settings saved successfully.' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings.',
        variant: 'destructive',
      });
    },
  });

  function onSubmit(data: NotificationSettingsValues) {
    saveMutation.mutate(data);
  }

  // Test email connection
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const emailData = form.getValues('email');
      const response = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to test email connection');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Email test successful', description: data.message || 'Test email sent.' });
    },
    onError: (error) => {
      toast({ title: 'Email test failed', description: error instanceof Error ? error.message : 'Check your settings.', variant: 'destructive' });
    },
  });

  // Test SMS connection
  const testSmsMutation = useMutation({
    mutationFn: async () => {
      const smsData = form.getValues('sms');
      const response = await fetch('/api/settings/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smsData),
      });
      if (!response.ok) throw new Error('Failed to test SMS connection');
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: 'SMS test successful', description: 'Test SMS sent successfully.' });
    },
    onError: () => {
      toast({ title: 'SMS test failed', description: 'Failed to send test SMS. Check your settings.', variant: 'destructive' });
    },
  });

  // Test WhatsApp connection
  const testWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const waData = form.getValues('whatsapp');
      const response = await fetch('/api/settings/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send WhatsApp test message');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({ title: 'WhatsApp test successful', description: data.message || 'Test message sent.' });
    },
    onError: (error) => {
      toast({ title: 'WhatsApp test failed', description: error instanceof Error ? error.message : 'Check your credentials.', variant: 'destructive' });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground">Configure email, SMS, and WhatsApp notification settings</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="email">Email Settings</TabsTrigger>
              <TabsTrigger value="sms">SMS Settings</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp Settings</TabsTrigger>
            </TabsList>

            {/* ── Email Tab ── */}
            <TabsContent value="email">
              <Card>
                <CardHeader>
                  <CardTitle>Email Notification Configuration</CardTitle>
                  <CardDescription>Configure SMTP settings for sending email notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email.enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Email Notifications</FormLabel>
                          <FormDescription>Turn on email notifications for gate pass updates</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email.host"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Host</FormLabel>
                          <FormControl><Input placeholder="smtp.example.com" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email.port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Port</FormLabel>
                          <FormControl><Input type="number" placeholder="587" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email.secure"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Use Secure Connection (SSL/TLS)</FormLabel>
                          <FormDescription>Enable secure connection for SMTP</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email.user"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Username</FormLabel>
                          <FormControl><Input placeholder="username@example.com" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email.password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Password</FormLabel>
                          <FormControl><Input type="password" placeholder="●●●●●●●●" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button type="button" variant="outline" onClick={() => testEmailMutation.mutate()} disabled={testEmailMutation.isPending}>
                      {testEmailMutation.isPending ? 'Testing...' : 'Test Connection'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── SMS Tab ── */}
            <TabsContent value="sms">
              <Card>
                <CardHeader>
                  <CardTitle>SMS Notification Configuration</CardTitle>
                  <CardDescription>Configure Twilio settings for sending SMS notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="sms.enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable SMS Notifications</FormLabel>
                          <FormDescription>Turn on SMS notifications for gate pass updates</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sms.accountSid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twilio Account SID</FormLabel>
                        <FormControl><Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sms.authToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twilio Auth Token</FormLabel>
                        <FormControl><Input type="password" placeholder="●●●●●●●●" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sms.phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twilio Phone Number</FormLabel>
                        <FormControl><Input placeholder="+1234567890" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end pt-4">
                    <Button type="button" variant="outline" onClick={() => testSmsMutation.mutate()} disabled={testSmsMutation.isPending}>
                      {testSmsMutation.isPending ? 'Testing...' : 'Test SMS'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── WhatsApp Tab ── */}
            <TabsContent value="whatsapp">
              <Card>
                <CardHeader>
                  <CardTitle>WhatsApp Notification Configuration</CardTitle>
                  <CardDescription>
                    Configure Meta WhatsApp Business API settings. Obtain your Phone Number ID and Access Token from the{' '}
                    <span className="font-medium text-foreground">Meta for Developers</span> portal under your WhatsApp Business app.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="whatsapp.enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable WhatsApp Notifications</FormLabel>
                          <FormDescription>
                            Send workflow alerts via WhatsApp to users whose phone numbers are set in their profiles
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsapp.phoneNumberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number ID</FormLabel>
                        <FormControl>
                          <Input placeholder="123456789012345" {...field} />
                        </FormControl>
                        <FormDescription>
                          Found in your Meta App Dashboard under WhatsApp → API Setup
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsapp.accessToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Token</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="●●●●●●●●" {...field} />
                        </FormControl>
                        <FormDescription>
                          Use a permanent System User token for production (not the temporary token)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsapp.testNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test Recipient Number</FormLabel>
                        <FormControl>
                          <Input placeholder="03001234567" {...field} />
                        </FormControl>
                        <FormDescription>
                          Pakistani format (e.g. 03001234567). The number must have opted-in to receive messages.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => testWhatsAppMutation.mutate()}
                      disabled={testWhatsAppMutation.isPending}
                    >
                      {testWhatsAppMutation.isPending ? 'Sending...' : 'Send Test Message'}
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
              className="w-full md:w-auto"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
