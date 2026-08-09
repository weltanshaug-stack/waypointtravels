import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/waypoint/SiteHeader";
import { TripGuide } from "@/components/waypoint/TripGuide";
import { getTrip } from "@/lib/waypoint/trip.functions";

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  head: () => ({
    meta: [
      { title: "Saved trip — WayPoint" },
      { name: "description", content: "A saved WayPoint AI travel guide with itinerary, budget and trip check." },
      { property: "og:title", content: "Saved trip — WayPoint" },
      { property: "og:description", content: "Day-by-day itinerary, budget breakdown and AI trip check." },
    ],
  }),
  component: TripDetail,
});

function TripDetail() {
  const { tripId } = Route.useParams();
  const fetchTrip = useServerFn(getTrip);

  const { data, isLoading, error } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchTrip({ data: { id: tripId } }),
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/trips">
            <ArrowLeft className="mr-1 h-4 w-4" /> All trips
          </Link>
        </Button>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        )}

        {error && (
          <div className="surface-card p-8 text-center">
            <p className="font-medium">We couldn't load this trip.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/trips">Back to my trips</Link>
            </Button>
          </div>
        )}

        {data?.result && <TripGuide result={data.result} />}
      </main>
    </div>
  );
}
