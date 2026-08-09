import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Compass, ScrollText, ShieldCheck } from "lucide-react";
import { Hero } from "@/components/wandor/Hero";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Waypoint — Where will you go next?" },
      {
        name: "description",
        content:
          "Waypoint turns what you love into a personalized day-by-day travel itinerary with costs, pace and accessibility built in.",
      },
      { property: "og:title", content: "Waypoint — Where will you go next?" },
      {
        property: "og:description",
        content: "Tell Waypoint about your trip and get a clear, personalized itinerary in minutes.",
      },
    ],
  }),
  component: Landing,
});

const FLOW = [
  {
    icon: Compass,
    title: "Tell us the shape of your trip",
    body: "Dates, budget, pace, who's coming and anything else that matters.",
  },
  {
    icon: CalendarCheck,
    title: "We plan and stress-test it",
    body: "Costs, travel times and accessibility are checked before you see the plan.",
  },
  {
    icon: ScrollText,
    title: "Get a day-by-day guide",
    body: "Clear days, real costs, photos, and one tap to make it cheaper or calmer.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <main>
        <Hero />

        <section id="how-it-works" className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="text-display max-w-2xl text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            Planning that adapts to you, not the other way round.
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {FLOW.map((step, i) => (
              <div key={step.title}>
                <step.icon className="h-6 w-6 text-accent-foreground" aria-hidden="true" />
                <p className="mt-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Step {i + 1}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-4">
            <Link
              to="/plan"
              className="rounded-full bg-primary px-6 py-3.5 font-sans text-[15px] font-medium tracking-[0.04em] text-primary-foreground uppercase transition-all hover:opacity-90 active:scale-95"
            >
              Plan My Trip
            </Link>
            <Link
              to="/plan"
              search={{ demo: true }}
              className="rounded-full border border-border px-6 py-3.5 font-sans text-[15px] font-medium tracking-[0.04em] uppercase transition-opacity hover:opacity-60"
            >
              Try a demo trip
            </Link>
          </div>

          <p className="mt-10 flex max-w-3xl items-start gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Prices, times and accessibility details are estimates — always confirm before booking.
          </p>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <span className="font-logo text-base">Waypoint</span> — personalized travel planning.
      </footer>
    </div>
  );
}
