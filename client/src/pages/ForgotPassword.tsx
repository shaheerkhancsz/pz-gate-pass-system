import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { companyName, companyLogo } from "@/config/company";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid company email address"),
});

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ForgotPasswordInput) {
    try {
      setIsLoading(true);
      // Send password reset request to the server
      await apiRequest("POST", "/api/auth/forgot-password", data);
      
      toast({
        title: "Reset link sent",
        description: "Please check your email for password reset instructions.",
      });
      
      // Navigate back to login page after 3 seconds
      setTimeout(() => navigate("/login"), 3000);
    } catch (error) {
      console.error("Password reset request failed:", error);
      toast({
        title: "Error",
        description: "Failed to send reset link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="max-w-md w-full px-6">
        <div className="text-center mb-8">
          <img
            src={companyLogo.full}
            alt={`${companyName} Logo`}
            className="mx-auto mb-4 h-16 object-contain"
          />
          <h1 className="text-2xl font-bold text-primary">{companyName}</h1>
          <p className="text-neutral-gray mt-2">Gate Pass Management System</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-medium mb-2">Reset Password</h2>
          <p className="text-neutral-gray mb-6">Enter your company email address and we'll send you instructions to reset your password.</p>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="example@agp.com.pk"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="pt-2 space-y-2">
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary-dark text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="mr-2 animate-spin">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                        </svg>
                      </span>
                      Sending Reset Link...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/login")}
                  disabled={isLoading}
                >
                  Back to Login
                </Button>
              </div>
            </form>
          </Form>
        </div>
        
        <div className="text-center mt-6 text-sm text-neutral-gray">
          <p>
            Having trouble? Contact IT Support at{" "}
            <a href="mailto:it.support@agp.com.pk" className="text-primary">
              it.support@agp.com.pk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
} 