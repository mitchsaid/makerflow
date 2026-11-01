import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { TERMS_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of use · MakerFlow" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro="The agreement between you and MakerFlow when you use it."
      sections={TERMS_SECTIONS}
      other={{ href: "/privacy", label: "Read the privacy policy" }}
    />
  );
}
