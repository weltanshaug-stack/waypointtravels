import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import heroImage from "@/assets/hero.jpg";
import logo from "@/assets/logo.png.asset.json";

function NavButton({ label }: { label: string }) {
  return (
    <a
      href="#how-it-works"
      className="cursor-pointer border-none bg-transparent font-sans text-[15px] font-medium tracking-[0.04em] text-wandor-text uppercase transition-opacity hover:opacity-55"
    >
      {label}
    </a>
  );
}

export function Hero() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <section className="relative min-h-svh w-full overflow-hidden">
      <img
        src={heroImage}
        alt="Turquoise coastal bay framed by green cliffs at golden hour"
        width={1920}
        height={1280}
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[560px]"
        style={{
          background: "linear-gradient(180deg, rgba(253,248,238,0.96) 0%, rgba(253,248,238,0) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[420px]"
        style={{
          background: "linear-gradient(0deg, rgba(253,248,238,0.9) 0%, rgba(253,248,238,0) 100%)",
        }}
      />

      <div className="relative z-[2] mx-auto flex min-h-svh max-w-[1360px] flex-col">
        <nav className="flex items-center justify-between px-6 pt-5 pb-4 md:px-20 md:pt-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo.url} alt="Waypoint logo" className="h-9 w-9 object-contain md:h-11 md:w-11" />
            <span className="font-logo text-[30px] leading-none md:text-[36px]">Waypoint</span>
          </Link>

          <div className="absolute left-1/2 flex -translate-x-1/2 gap-8 max-md:hidden">
            <NavButton label="Discover" />
            <NavButton label="How it works" />
            <NavButton label="FAQs" />
          </div>

          <div className="flex items-center gap-8">
            <Link
              to={user ? "/trips" : "/auth"}
              className="cursor-pointer border-none bg-transparent font-sans text-[15px] font-semibold tracking-[0.04em] text-[#292929] uppercase transition-opacity hover:opacity-55 max-md:hidden"
            >
              {user ? "My trips" : "Login"}
            </Link>
            <button
              type="button"
              onClick={() => navigate({ to: "/plan" })}
              className="cursor-pointer rounded-full border-none bg-primary px-5 py-3.5 font-sans text-[15px] font-medium tracking-[0.04em] text-primary-foreground uppercase transition-all hover:opacity-90 active:scale-95"
            >
              Plan My Trip
            </button>
          </div>
        </nav>

        <div className="flex flex-1 flex-col items-center justify-center px-6 pt-10 pb-24 text-center">
          <h1 className="mb-5 max-w-[820px] font-sans text-[clamp(40px,6vw,68px)] leading-[1.05] font-medium tracking-[-0.04em] text-wandor-text">
            Where will you go next?
          </h1>
          <p className="mb-10 max-w-[520px] font-sans text-xl leading-relaxed font-medium text-wandor-muted">
            Tell us where you're going and what you love. We'll build a personalized day-by-day
            itinerary with real costs.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/plan"
              className="rounded-full bg-primary px-7 py-4 font-sans text-[15px] font-medium tracking-[0.04em] text-primary-foreground uppercase transition-all hover:opacity-90 active:scale-95"
            >
              Start planning
            </Link>
            <Link
              to="/plan"
              search={{ demo: true }}
              className="rounded-full border border-foreground/20 bg-background/70 px-7 py-4 font-sans text-[15px] font-medium tracking-[0.04em] uppercase backdrop-blur-md transition-opacity hover:opacity-70"
            >
              Try a demo trip
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
