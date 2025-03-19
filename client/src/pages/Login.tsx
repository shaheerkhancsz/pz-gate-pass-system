import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  async function onSubmit(data: LoginInput) {
    try {
      setIsLoading(true);
      await login(data);
      navigate("/");
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="max-w-md w-full px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">Parazelsus Pakistan</h1>
          <p className="text-neutral-gray mt-2">Gate Pass Management System</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-medium mb-6">Login to your account</h2>
          
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
                        placeholder="example@parazelsus.pk"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <p className="text-xs text-neutral-gray mt-1">Please use your company email address</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-gray hover:text-neutral-dark"
                        onClick={togglePasswordVisibility}
                      >
                        <span className="material-icons">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormLabel className="text-sm cursor-pointer">Remember me</FormLabel>
                    </FormItem>
                  )}
                />
                
                <div>
                  <a 
                    onClick={() => navigate("/forgot-password")}
                    className="text-sm text-primary hover:text-primary-dark cursor-pointer"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>
              
              <div className="pt-2">
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
                      Logging in...
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
        
        <div className="text-center mt-6 text-sm text-neutral-gray">
          <p>
            Having trouble? Contact IT Support at{" "}
            <a href="mailto:it.support@parazelsus.pk" className="text-primary">
              it.support@parazelsus.pk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
