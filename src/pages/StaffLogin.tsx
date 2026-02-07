import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, LayoutGrid, Loader2 } from "lucide-react";
export default function StaffLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/staff`,
            data: {
              full_name: name || email.split("@")[0],
            }
          },
        });

        if (error) {
          if (error.message.includes("email_not_confirmed")) {
            toast.error("Please check your email and confirm your account before signing in.");
          } else {
            toast.error(error.message);
          }
          return;
        }

        if (data.user) {
          try {
            // Create Profile
            const { error: profileError } = await supabase.from("profiles").insert({
              id: data.user.id,
              full_name: name || email.split("@")[0],
              email,
              role: "staff",
            });

            if (profileError) {
              console.error("Profile creation error:", profileError);
              toast.warning("Account created but profile setup incomplete. Please contact admin.");
            }

            // Create Staff Entry
            const { error: staffError } = await supabase.from("staff").insert({
              id: data.user.id,
              is_available: false,
            });

            if (staffError) {
              console.error("Staff record error:", staffError);
              if (staffError.message.includes("name")) {
                toast.warning("Account created! Staff record may need manual setup.");
              } else {
                toast.warning("Account created but staff setup incomplete. Please contact admin.");
              }
            }
          } catch (insertError: any) {
            console.error("Insert error:", insertError);
            toast.warning("Account created but additional setup needed. Please contact admin.");
          }
        }

        toast.success("Account created! Check your email to confirm, then sign in.", { duration: 5000 });
        setIsSignUp(false);
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          if (error.message.includes("Email not confirmed")) {
            toast.error("Please confirm your email address before signing in. Check your inbox.");
          } else if (error.message.includes("Invalid login credentials")) {
            toast.error("Invalid email or password. Please try again.");
          } else {
            toast.error(error.message);
          }
          return;
        }

        // Check if user is staff
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle();

        if (staffError) {
          console.error("Staff query error:", staffError);
          await supabase.auth.signOut();
          toast.error("Error checking staff status. Please try signing up again.");
          return;
        }

        if (!staffData) {
          await supabase.auth.signOut();
          toast.error("You are not registered as staff. Please sign up first.");
          return;
        }

        toast.success("Welcome back!");
        navigate("/staff");
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast.error(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!email) {
      toast.error("Please enter your email address to receive a reset link.");
      return;
    }

    setLoading(true);
    try {
      // Try to send a password reset magic link. If the method isn't available,
      // fall back to sending a sign-in magic link.
      const redirectTo = `${window.location.origin}/staff/login`;
      let result: any;

      try {
        // Preferred: password reset link
        result = await (supabase.auth as any).resetPasswordForEmail(email, { redirectTo });
      } catch (e) {
        // Fallback: send sign-in magic link
        result = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      }

      if (result?.error) {
        console.error("Reset link error:", result.error);
        toast.error(result.error.message || "Failed to send reset link");
      } else {
        toast.success("Check your inbox — a reset/magic link was sent if the email exists.");
      }
    } catch (err: any) {
      console.error("Unexpected error sending reset link:", err);
      toast.error(err?.message || "Could not send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row font-sans">
      {/* Brand Section Side (Desktop) */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-blue-600 p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700 opacity-90" />
        <div className="relative z-10">
          <div className="h-12 w-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center mb-6">
            <LayoutGrid className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold font-display mb-2">Staff Portal</h1>
          <p className="text-blue-100 text-lg">Manage queues effectively.</p>
        </div>
        <div className="relative z-10 text-blue-200 text-sm">
          © 2026 Transparent Queue
        </div>
        {/* Decor */}
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      {/* Login Form Side */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-900 text-sm mb-8 transition-colors font-medium">
            <ArrowLeft className="h-4 w-4" /> Back to Main Site
          </Link>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2 font-display">
              {isSignUp ? "Create Staff Account" : "Staff Sign In"}
            </h2>
            <p className="text-neutral-500 text-sm">
              {isSignUp ? "Join the team to start managing services." : "Welcome back! Please enter your details."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Officer Judy"
                  required={isSignUp}
                  className="h-11 bg-neutral-50"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                placeholder="name@agency.gov"
                required
                className="h-11 bg-neutral-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-11 bg-neutral-50"
              />
              <div className="text-right mt-2">
                <button
                  type="button"
                  onClick={handleSendResetLink}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              {isSignUp ? "Already have an account? Sign in" : "New staff member? Create account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
