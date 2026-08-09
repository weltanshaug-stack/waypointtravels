import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, MapPinned, ScrollText, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/waypoint/SiteHeader";
import heroImage from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WayPoint — AI travel planning that fits you" },
      {
        name: "description",
        content:
          "WayPoint's AI agents build personalized travel plans around your budget, interests, schedule, accessibility needs and travel style.",
      },
      { property: "og:title", content: "WayPoint — AI travel planning that fits you" },
      {
        property: "og:description",
        content:
          "Tell us what you need. WayPoint's AI agents plan, budget, optimize and stress-test your whole trip.",
      },
    ],
  }),
  component: Landing,
});

const FLOW = [
  {
    icon: MapPinned,
    title: "Your preferences",
    body: "Budget, dates, pace, travel styles, accessibility needs and anything in your own words.",
  },
  {
    icon: Brain,
    title: "AI travel agents",
    body: "Analyzer → planner → budget → accessibility → schedule → critic, coordinated by an orchestrator.",
  },
  {
    icon: ScrollText,
    title: "Personalized guide",
    body: "A day-by-day itinerary with costs, travel times, rest periods and a reason behind every choice.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="grain-hero border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div className="animate-rise">
              <Badge className="gap-1">
                <Sparkles className="h-3 w-3" /> Agentic travel planning
              </Badge>
              <h1 className="text-display mt-5 text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
                Plan a trip that actually fits <span className="text-primary">YOU</span>.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                WayPoint uses AI agents to build personalized travel plans around your budget, interests,
                schedule, accessibility needs, and travel style.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/plan">
                    Plan My Trip <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/plan" search={{ demo: true }}>
                    Try Demo Trip
                  </Link>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                No account needed to generate your first trip.
              </p>
            </div>

            <div className="animate-rise overflow-hidden rounded-3xl border border-border shadow-lift">
              <img
                src={heroImage}
                alt="Coastal road winding along cliffs above turquoise water"
                width={1600}
                height={1104}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-display text-center text-2xl font-semibold sm:text-3xl">
            User preferences → AI travel agent → personalized vacation guide
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {FLOW.map((step, i) => (
              <div key={step.title} className="surface-card relative p-6">
                <span className="absolute top-6 right-6 text-display text-3xl font-semibold text-primary-soft">
                  0{i + 1}
                </span>
                <step.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="surface-card mt-10 flex flex-wrap items-center gap-3 p-5 text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <p>
              WayPoint has no live travel APIs connected in this build, so prices, durations and accessibility
              details are clearly labelled AI estimates — verify before booking. Accessibility is always
              reported/estimated, never guaranteed, and nothing here is medical advice.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        WayPoint — an AI travel operating system.
      </footer>
    </div>
  );
}
