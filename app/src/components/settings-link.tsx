import Link from "next/link";
import { SettingsIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * The way into a list's settings (Quote settings, Invoice settings, Product settings): a gear after the list's main
 * action ("New quote"), so the action comes first and the settings stay one tap away without taking a row of words.
 * It is a full 44 px tap target; the icon is decoration, the link's name and tooltip say where it goes.
 */
export function SettingsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className={buttonVariants({ variant: "outline", size: "icon" })}>
      <SettingsIcon aria-hidden="true" />
    </Link>
  );
}
