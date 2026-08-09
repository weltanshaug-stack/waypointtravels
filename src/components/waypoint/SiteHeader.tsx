import { Link, useNavigate } from "@tanstack/react-router";
import logo from "@/assets/logo.png.asset.json";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function SiteHeader() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const linkClass =
    "font-sans text-[15px] font-medium uppercase tracking-[0.04em] transition-opacity hover:opacity-55";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo.url} alt="WayPoint logo" className="h-8 w-8 object-contain" />
          <span className="font-logo text-[26px] leading-none">WayPoint</span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link to="/plan" className={linkClass}>
            Plan
          </Link>
          {loading ? null : user ? (
            <>
              <Link to="/trips" className={linkClass}>
                My trips
              </Link>
              <button type="button" onClick={signOut} className={`${linkClass} cursor-pointer`}>
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-full bg-primary px-4 py-2.5 font-sans text-[14px] font-medium tracking-[0.04em] text-primary-foreground uppercase transition-all hover:opacity-90 active:scale-95"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
