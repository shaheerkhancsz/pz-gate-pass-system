import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/layout/AppLayout";
import { companyConfig } from "@/config/company";
import { useToast } from "@/hooks/use-toast";

// Form schema
const companyFormSchema = z.object({
  // Basic info
  name: z.string().min(2, "Company name is required"),
  fullName: z.string().min(2, "Full company name is required"),
  tagline: z.string().optional(),
  
  // Contact
  address: z.string().min(5, "Address is required"),
  phone: z.string().min(5, "Phone number is required"),
  email: z.string().email("Invalid email address"),
  website: z.string().optional(),
  
  // Colors
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color format"),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color format"),
  successColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color format"),
  warningColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color format"),
  errorColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color format"),
  
  // Footer
  footerText: z.string().min(2, "Footer text is required"),
  
  // GatePass
  gatePassPrefix: z.string().min(2, "Gate pass prefix is required"),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

export default function CompanySettings() {
  const { toast } = useToast();
  
  // Initial values from the config
  const defaultValues: CompanyFormValues = {
    name: companyConfig.name,
    fullName: companyConfig.fullName,
    tagline: companyConfig.tagline || "",
    
    address: companyConfig.address,
    phone: companyConfig.phone,
    email: companyConfig.email,
    website: companyConfig.website || "",
    
    primaryColor: companyConfig.colors.primary,
    secondaryColor: companyConfig.colors.secondary,
    successColor: companyConfig.colors.success,
    warningColor: companyConfig.colors.warning,
    errorColor: companyConfig.colors.error,
    
    footerText: companyConfig.footerText,
    gatePassPrefix: companyConfig.gatePassPrefix,
  };
  
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues,
  });
  
  // Function to update theme.json with the new primary color
  const updateThemeColor = (primaryColor: string) => {
    // In a real application, we would make an API call to update the theme.json file
    // For this demo, we'll use localStorage to store theme settings
    try {
      const currentTheme = {
        variant: "professional",
        primary: primaryColor,
        appearance: "light",
        radius: 0.6
      };
      
      localStorage.setItem('themeSettings', JSON.stringify(currentTheme));
      
      // Add a meta tag to indicate theme color for mobile browsers
      let metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.setAttribute('name', 'theme-color');
        document.head.appendChild(metaThemeColor);
      }
      metaThemeColor.setAttribute('content', primaryColor);
      
      return true;
    } catch (error) {
      console.error("Error updating theme color:", error);
      return false;
    }
  };
  
  function onSubmit(data: CompanyFormValues) {
    // Store settings in localStorage for persistence between sessions
    try {
      // Convert form data to companyConfig format
      const updatedCompanyConfig = {
        name: data.name,
        fullName: data.fullName,
        tagline: data.tagline,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        colors: {
          primary: data.primaryColor,
          secondary: data.secondaryColor,
          success: data.successColor,
          warning: data.warningColor,
          error: data.errorColor,
          info: companyConfig.colors.info, // Maintain existing info color
        },
        logo: companyConfig.logo, // Keep existing logo paths
        footerText: data.footerText,
        gatePassPrefix: data.gatePassPrefix,
        social: companyConfig.social, // Keep existing social media links
      };
      
      // Save to localStorage
      localStorage.setItem('companyConfig', JSON.stringify(updatedCompanyConfig));
      
      // Update theme color
      const themeUpdated = updateThemeColor(data.primaryColor);
      
      // In a real implementation, this would save to a database
      console.log("Updated company settings:", updatedCompanyConfig);
      
      // Show success toast
      toast({
        title: "Settings updated",
        description: themeUpdated 
          ? "Company information has been updated successfully. Please reload the page to see all changes."
          : "Company information saved but theme color could not be updated. Please try again.",
        variant: "default",
        duration: 5000,
      });
      
      // In a production environment, you would also:
      // 1. Save to database
      // 2. Update the theme.json file with the primary color via API
      // 3. Trigger a rebuild or hot reload of the application
    } catch (error) {
      console.error("Error saving company settings:", error);
      toast({
        title: "Error",
        description: "Failed to save company settings. Please try again.",
        variant: "destructive",
      });
    }
  }
  
  return (
    <AppLayout>
      <div className="container mx-auto py-6 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">Company Settings</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Configure Company Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="general">
              <TabsList className="mb-6">
                <TabsTrigger value="general">General Information</TabsTrigger>
                <TabsTrigger value="branding">Branding & Colors</TabsTrigger>
                <TabsTrigger value="contact">Contact Details</TabsTrigger>
                <TabsTrigger value="logos">Logos & Images</TabsTrigger>
              </TabsList>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <TabsContent value="general">
                    <div className="grid gap-4 py-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Legal Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="tagline"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Tagline</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="gatePassPrefix"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gate Pass Number Prefix</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                            <p className="text-sm text-gray-500">This will be used in your gate pass numbers (e.g., {field.value}-001)</p>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="footerText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Footer Text</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="branding">
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="primaryColor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Primary Color</FormLabel>
                              <div className="flex items-center space-x-2">
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <div
                                  className="w-10 h-10 rounded-full border"
                                  style={{ backgroundColor: field.value }}
                                />
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="secondaryColor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Secondary Color</FormLabel>
                              <div className="flex items-center space-x-2">
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <div
                                  className="w-10 h-10 rounded-full border"
                                  style={{ backgroundColor: field.value }}
                                />
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="successColor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Success Color</FormLabel>
                              <div className="flex items-center space-x-2">
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <div
                                  className="w-8 h-8 rounded-full border"
                                  style={{ backgroundColor: field.value }}
                                />
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="warningColor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Warning Color</FormLabel>
                              <div className="flex items-center space-x-2">
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <div
                                  className="w-8 h-8 rounded-full border"
                                  style={{ backgroundColor: field.value }}
                                />
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="errorColor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Error Color</FormLabel>
                              <div className="flex items-center space-x-2">
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <div
                                  className="w-8 h-8 rounded-full border"
                                  style={{ backgroundColor: field.value }}
                                />
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="mt-6">
                        <h3 className="text-lg font-medium mb-2">Theme Preview</h3>
                        <div className="flex flex-wrap gap-2">
                          <div className="p-4 rounded" style={{ backgroundColor: form.watch("primaryColor") }}>
                            <span className="text-white font-medium">Primary</span>
                          </div>
                          <div className="p-4 rounded" style={{ backgroundColor: form.watch("secondaryColor") }}>
                            <span className="text-white font-medium">Secondary</span>
                          </div>
                          <div className="p-4 rounded" style={{ backgroundColor: form.watch("successColor") }}>
                            <span className="text-white font-medium">Success</span>
                          </div>
                          <div className="p-4 rounded" style={{ backgroundColor: form.watch("warningColor") }}>
                            <span className="text-white font-medium">Warning</span>
                          </div>
                          <div className="p-4 rounded" style={{ backgroundColor: form.watch("errorColor") }}>
                            <span className="text-white font-medium">Error</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="contact">
                    <div className="grid gap-4 py-4">
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Address</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website URL</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="logos">
                    <div className="grid gap-4 py-4">
                      <div className="border rounded-md p-6 flex flex-col items-center">
                        <h3 className="text-lg font-medium mb-4">Company Logo</h3>
                        <div className="bg-gray-100 p-4 rounded mb-4">
                          <img 
                            src={companyConfig.logo.full} 
                            alt="Company logo" 
                            className="max-w-full h-auto max-h-24" 
                          />
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                          To update your company logo, replace the files in the assets folder:
                        </p>
                        <pre className="bg-gray-100 p-2 rounded text-sm mb-4 w-full overflow-auto">
                          /assets/logo-full.svg (Full logo with text)<br />
                          /assets/PZ-logo.gif (Icon only)
                        </pre>
                        <p className="text-sm text-gray-500">
                          For best results, use SVG format for your logos. For icons, GIF or SVG formats are supported.
                        </p>
                      </div>
                      
                      <div className="border rounded-md p-6 flex flex-col items-center">
                        <h3 className="text-lg font-medium mb-4">Logo Icon (Parazelsus Pakistan)</h3>
                        <div className="bg-gray-100 p-4 rounded mb-4">
                          <img 
                            src={companyConfig.logo.icon} 
                            alt="Logo icon" 
                            className="max-w-full h-auto max-h-16" 
                          />
                        </div>
                        <p className="text-sm text-gray-500">
                          This icon is used in the navigation bar and other places where space is limited.
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <div className="flex justify-end mt-6 space-x-2">
                    <Button type="button" variant="outline" onClick={() => form.reset(defaultValues)}>
                      Reset
                    </Button>
                    <Button type="submit" className="bg-primary text-white">
                      <span className="mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                          <polyline points="17 21 17 13 7 13 7 21"></polyline>
                          <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                      </span>
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}