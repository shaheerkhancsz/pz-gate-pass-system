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
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

// Validation schema for email settings
const emailSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  host: z.string().min(1, 'SMTP host is required'),
  port: z.coerce.number().int().min(1, 'Port is required'),
  secure: z.boolean().default(false),
  user: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// Validation schema for SMS settings
const smsSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  accountSid: z.string().min(1, 'Account SID is required'),
  authToken: z.string().min(1, 'Auth Token is required'),
  phoneNumber: z.string().min(1, 'Phone number is required')
});

// Combined schema
const settingsSchema = z.object({
  email: emailSettingsSchema,
  sms: smsSettingsSchema
});

type NotificationSettingsValues = z.infer<typeof settingsSchema>;

export default function NotificationSettings() {
  const [activeTab, setActiveTab] = useState('email');
  const { toast } = useToast();

  // Define the expected response type
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
  }

  const defaultSettings: NotificationSettingsResponse = {
    email: {
      enabled: false,
      host: '',
      port: 587,
      secure: false,
      user: '',
      password: '',
    },
    sms: {
      enabled: false,
      accountSid: '',
      authToken: '',
      phoneNumber: '',
    }
  };

  // Fetch settings
  const { data: settings, isLoading } = useQuery<NotificationSettingsResponse>({
    queryKey: ['/api/settings/notifications'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/settings/notifications');
        if (!response.ok) {
          throw new Error('Failed to fetch notification settings');
        }
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
      email: {
        enabled: false,
        host: '',
        port: 587,
        secure: false,
        user: '',
        password: '',
      },
      sms: {
        enabled: false,
        accountSid: '',
        authToken: '',
        phoneNumber: '',
      }
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
        }
      });
    }
  }, [settings, form]);

  // Save settings
  const saveMutation = useMutation({
    mutationFn: async (data: NotificationSettingsValues) => {
      const response = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save notification settings');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/notifications'] });
      toast({
        title: 'Settings saved',
        description: 'Your notification settings have been saved successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
      console.error('Error saving settings:', error);
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to test email connection');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Email test successful',
        description: 'The test email was sent successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Email test failed',
        description: 'Failed to send the test email. Please check your settings.',
        variant: 'destructive',
      });
      console.error('Error testing email:', error);
    },
  });

  // Test SMS connection
  const testSmsMutation = useMutation({
    mutationFn: async () => {
      const smsData = form.getValues('sms');
      const response = await fetch('/api/settings/test-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(smsData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to test SMS connection');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'SMS test successful',
        description: 'The test SMS was sent successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'SMS test failed',
        description: 'Failed to send the test SMS. Please check your settings.',
        variant: 'destructive',
      });
      console.error('Error testing SMS:', error);
    },
  });

  const handleTestEmail = () => {
    testEmailMutation.mutate();
  };

  const handleTestSms = () => {
    testSmsMutation.mutate();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground">Configure email and SMS notification settings</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email Settings</TabsTrigger>
              <TabsTrigger value="sms">SMS Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <Card>
                <CardHeader>
                  <CardTitle>Email Notification Configuration</CardTitle>
                  <CardDescription>
                    Configure SMTP settings for sending email notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email.enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Email Notifications</FormLabel>
                          <FormDescription>
                            Turn on email notifications for gate pass updates
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
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
                          <FormControl>
                            <Input placeholder="smtp.example.com" {...field} />
                          </FormControl>
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
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="587"
                              {...field}
                            />
                          </FormControl>
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
                          <FormDescription>
                            Enable secure connection for SMTP
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
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
                          <FormControl>
                            <Input
                              placeholder="username@example.com"
                              {...field}
                            />
                          </FormControl>
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
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="●●●●●●●●"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestEmail}
                      disabled={testEmailMutation.isPending}
                    >
                      {testEmailMutation.isPending ? 'Testing...' : 'Test Connection'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sms">
              <Card>
                <CardHeader>
                  <CardTitle>SMS Notification Configuration</CardTitle>
                  <CardDescription>
                    Configure Twilio settings for sending SMS notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="sms.enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable SMS Notifications</FormLabel>
                          <FormDescription>
                            Turn on SMS notifications for gate pass updates
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
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
                        <FormControl>
                          <Input
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            {...field}
                          />
                        </FormControl>
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
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="●●●●●●●●"
                            {...field}
                          />
                        </FormControl>
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
                        <FormControl>
                          <Input
                            placeholder="+1234567890"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestSms}
                      disabled={testSmsMutation.isPending}
                    >
                      {testSmsMutation.isPending ? 'Testing...' : 'Test SMS'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
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