import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Compass, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/waypoint/SiteHeader";
import { deleteTrip, listTrips } from "@/lib/waypoint/trip.functions";
import { formatMoney } from "@/lib/waypoint/types";

export const Route = createFileRoute("/_authenticated/trips/")({
  head: () => ({
    meta: [
      { title: "My trips — WayPoint" },
      { name: "description", content: "Your saved AI-generated WayPoint travel guides." },
      { property: "og:title", content: "My trips — WayPoint" },
      { property: "og:description", content: "Revisit, review and manage your saved travel plans." },
    ],
  }),
  component: TripsPage,
});

function TripsPage() {
  const fetchTrips = useServerFn(listTrips);
  const removeTrip = useServerFn(deleteTrip);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["trips"],
    queryFn: () => fetchTrips(),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeTrip({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Trip deleted.");
    },
    onError: () => toast.error("Could not delete that trip."),
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-display text-3xl font-semibold sm:text-4xl">My trips</h1>
            <p className="mt-2 text-muted-foreground">Every guide your agents have built for you.</p>
          </div>
          <Button onClick={() => navigate({ to: "/plan" })}>
            <Plus className="mr-1 h-4 w-4" /> New trip
          </Button>
        </header>

        <div className="mt-8">
          {isLoading && (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          )}

          {error && (
            <div className="surface-card p-8 text-center">
              <p className="font-medium">We couldn't load your trips.</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["trips"] })}
              >
                Try again
              </Button>
            </div>
          )}

          {data && data.length === 0 && (
            <div className="surface-card animate-rise flex flex-col items-center p-12 text-center">
              <Compass className="h-10 w-10 text-primary" />
              <h2 className="text-display mt-4 text-xl font-semibold">No saved trips yet</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Tell the agents what you need and your first personalized guide will land here.
              </p>
              <Button asChild className="mt-6">
                <Link to="/plan">Plan my first trip</Link>
              </Button>
            </div>
          )}

          {data && data.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {data.map((trip) => (
                <article key={trip.id} className="surface-card animate-rise flex flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-display truncate text-xl font-semibold">{trip.destination}</h2>
                      <p className="truncate text-sm text-muted-foreground">{trip.title}</p>
                    </div>
                    {trip.fit_score != null && <Badge variant="secondary">Fit {trip.fit_score}/100</Badge>}
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      {trip.start_date && trip.end_date
                        ? `${trip.start_date} → ${trip.end_date}`
                        : `${trip.days_count} days`}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {trip.travelers_adults + trip.travelers_children} travellers
                    </div>
                  </dl>

                  <p className="mt-3 text-sm text-muted-foreground">
                    Est. budget {formatMoney(Number(trip.budget_total ?? 0), trip.currency)} · saved{" "}
                    {new Date(trip.created_at).toLocaleDateString()}
                  </p>

                  <div className="mt-5 flex items-center gap-2">
                    <Button asChild size="sm">
                      <Link to="/trips/$tripId" params={{ tripId: trip.id }}>
                        View guide
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={del.isPending}
                      onClick={() => del.mutate(trip.id)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
