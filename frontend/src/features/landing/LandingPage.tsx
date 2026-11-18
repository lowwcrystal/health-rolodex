import { CtaSection } from "./CtaSection";
import { FeatureGrid } from "./FeatureGrid";
import { Hero } from "./Hero";
import { ProblemSection } from "./ProblemSection";

export function LandingPage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <FeatureGrid />
      <CtaSection />
    </>
  );
}
