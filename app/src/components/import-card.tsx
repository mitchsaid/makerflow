import Link from "@/components/app-link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * "Import" in a list's settings (docs/adr/0008-add-actions.md, list headers): the header of a list holds only the
 * create button and the settings gear, so bringing in a list from a spreadsheet lives here, with the list's other
 * settings. (The empty list also offers it, since that is when a new maker needs it.)
 */
export function ImportCard({ title, line, href, label }: { title: string; line: string; href: string; label: string }) {
  return (
    <Card data-testid="import-card">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-base">{line}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={href} className={buttonVariants({ variant: "outline", size: "lg" })} data-testid="import-link">
          {label}
        </Link>
      </CardContent>
    </Card>
  );
}
