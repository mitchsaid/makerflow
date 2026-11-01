import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { PRIVACY_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy · MakerFlow" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="What information MakerFlow keeps, why, who else handles it, and what you can ask us to do."
      sections={PRIVACY_SECTIONS}
      withServices
      other={{ href: "/terms", label: "Read the terms of use" }}
    />
  );
}
