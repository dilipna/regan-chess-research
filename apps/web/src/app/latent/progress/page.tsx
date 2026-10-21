import type { Metadata } from "next";
import { RouteMap } from "@/components/latent/progress/route-map";

export const metadata: Metadata = { title: "Your route", description: "Every stage from Foundations to red-team practice, what you have done, and what comes next." };

export default function Progress() {
  return <RouteMap />;
}
