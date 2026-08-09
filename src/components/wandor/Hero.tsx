import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import heroFallback from "@/assets/hero.jpg";

const VIDEO_SRC =
  "https://pollen-batch-41236914.figma.site/_components/v2/f0ee2dae7671c170c34f12e31c4cb41418976c98/769c564298c132f7919405cd9f17c1b1231f341d.769c5642.mp4";

const SAMPLE_PROMPT =
  "I'm planning a 7-day trip to Japan in October. I love food, hidden cafes, scenic hikes, and want to avoid crowds....";

export const PROMPT_KEY = "wandor:prompt";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState(SAMPLE_PROMPT);

  function start() {
    try {
      sessionStorage.setItem(PROMPT_KEY, prompt.trim());
    } catch {
      /* ignore */
    }
    navigate({ to: "/plan" });
  }

  return (
    <section
      className="relative min-h-svh w-full overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${heroFallback})` }}
    >
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src={VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[687px]"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
        }}
      />

      <div className="relative z-[2] mx-auto max-w-[1360px]">
        <nav className="flex items-center justify-between px-6 pt-5 pb-4 md:px-20 md:pt-6">
          <Link to="/" className="font-logo text-[32px] leading-none md:text-[38px]">
            WayPoint
          </Link>

          <div className="absolute left-1/2 flex -translate-x-1/2 gap-8 max-md:hidden">
            <NavButton label="Discover" />
            <NavButton label="Pricing" />
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
              onClick={start}
              className="cursor-pointer rounded-full border-none bg-primary px-5 py-3.5 font-sans text-[15px] font-medium tracking-[0.04em] text-primary-foreground uppercase transition-all hover:opacity-90 active:scale-95"
            >
              Plan My Trip
            </button>
          </div>
        </nav>

        <div className="flex flex-col items-center px-6 pt-16 pb-24 text-center">
          <h1 className="mb-5 max-w-[820px] font-sans text-[clamp(40px,6vw,68px)] leading-[1.05] font-medium tracking-[-0.04em] text-wandor-text">
            Where will you go next?
          </h1>
          <p className="mb-10 max-w-[500px] font-sans text-xl leading-relaxed font-medium text-wandor-muted">
            Tell our AI where you're going and what you love. We'll create a personalized itinerary for you.
          </p>

          <div className="glass-card relative min-h-[208px] w-[701px] overflow-hidden max-md:w-[calc(100vw-48px)]">
            <label htmlFor="wandor-prompt" className="sr-only">
              Describe your trip
            </label>
            <textarea
              id="wandor-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="absolute top-[57px] left-[29px] w-[609px] -translate-y-1/2 resize-none border-none bg-transparent font-sans text-xl leading-relaxed font-medium break-words text-wandor-prompt outline-none max-md:w-[calc(100%-58px)] max-md:text-[17px]"
            />

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={() => toast.success("Inspiration added — we'll factor in the vibe.")}
            />
            <button
              type="button"
              aria-label="Upload inspiration"
              onClick={() => fileRef.current?.click()}
              className="absolute top-[137px] left-[21px] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/70 bg-transparent backdrop-blur-[14px] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Upload size={20} color="#fff" />
            </button>

            <button
              type="button"
              onClick={start}
              className="absolute right-[21px] bottom-[21px] flex h-14 w-[156px] cursor-pointer items-center justify-center rounded-[44px] border-none bg-black font-sans text-base font-medium tracking-[0.02em] text-primary-foreground uppercase shadow-[0_0_2px_0_rgba(0,0,0,0.05)] transition-all hover:opacity-90 active:scale-95"
            >
              Plan My Trip
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
