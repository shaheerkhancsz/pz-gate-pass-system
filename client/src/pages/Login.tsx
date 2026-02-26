import React, { useState, useEffect } from "react";
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
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Monitor, Lock } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Company {
  id: number;
  name: string;
  shortName: string | null;
}

// ─── AD Login Form ─────────────────────────────────────────────────────────────

function AdLoginForm() {
  const { loginWithAd } = useAuth();
  const [, navigate] = useLocation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data: Company[]) => {
        const active = data.filter((c: any) => c.active !== false);
        setCompanies(active);
        if (active.length === 1) setCompanyId(String(active[0].id));
      })
      .catch(() => { });
  }, []);

  async function handleAdLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !username || !password) {
      setError("Please fill in all fields.");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/auth/ad-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: Number(companyId), username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "AD login failed");
        return;
      }
      // Store session the same way normal login does (AuthContext refetch)
      if (typeof loginWithAd === "function") {
        await loginWithAd(data);
      } else {
        // Fallback: reload to trigger auth context refetch
        window.location.href = "/";
        return;
      }
      navigate("/");
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleAdLogin} className="space-y-4">
      {/* Company selector */}
      {companies.length > 1 && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Company</label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger>
              <SelectValue placeholder="Select your company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Windows username */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Windows Username</label>
        <Input
          placeholder="e.g. john.doe or DOMAIN\\johndoe"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isLoading}
          autoComplete="username"
        />
        <p className="text-xs text-neutral-gray">Enter your Windows / Active Directory username</p>
      </div>

      {/* Password */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Windows Password</label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Enter your Windows password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-gray hover:text-neutral-dark"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            <span className="material-icons text-sm">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="pt-1">
        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary-dark text-white"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Authenticating…
            </>
          ) : (
            <>
              <Monitor className="w-4 h-4 mr-2" />
              Windows Login
            </>
          )}
        </Button>
      </div>

      {/* Info note */}
      <p className="text-xs text-center text-neutral-gray mt-1">
        Uses your existing Windows / Active Directory credentials
      </p>
    </form>
  );
}

// ─── Main Login Page ───────────────────────────────────────────────────────────

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

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="max-w-md w-full px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">Parazelsus Pakistan</h1>
          <p className="text-neutral-gray mt-2">Gate Pass Management System</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <Tabs defaultValue="local">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="local" className="flex-1 gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Email Login
              </TabsTrigger>
              <TabsTrigger value="ad" className="flex-1 gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Windows Login
              </TabsTrigger>
            </TabsList>

            {/* ── Local / Email Login ── */}
            <TabsContent value="local">
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
                        <p className="text-xs text-neutral-gray mt-1">
                          Please use your company email address
                        </p>
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-gray hover:text-neutral-dark"
                            onClick={() => setShowPassword(!showPassword)}
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
                    <a
                      onClick={() => navigate("/forgot-password")}
                      className="text-sm text-primary hover:text-primary-dark cursor-pointer"
                    >
                      Forgot password?
                    </a>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary-dark text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <svg
                            className="w-4 h-4 mr-2 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M21 12a9 9 0 1 1-6.219-8.56"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                          Logging in…
                        </>
                      ) : (
                        "Login"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            {/* ── Windows / AD Login ── */}
            <TabsContent value="ad">
              <AdLoginForm />
            </TabsContent>
          </Tabs>
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
