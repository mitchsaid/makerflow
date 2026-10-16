import Link from "next/link";
import { ChevronLeftIcon, XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The top of a page that sits under another (docs/adr/0009-back-navigation.md): a back control to the page's parent
 * in line with the heading, like an app, not an underlined link above it like a website. It always goes to the
 * parent, never to the browser's history, so it works the same after a deep link or in the installed app. The
 * children are the heading and anything under it (a line of help, a status).
 */
/** The back control on its own (the theme studio asks before leaving, so it adds an onClick). */
export function BackLink({
  href,
  label,
  onClick,
  className,
}: {
  href: string;
  /** The parent's name: "Quotes", read out as "Back to Quotes". */
  label: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={`Back to ${label}`}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "-ml-3 size-11 shrink-0", className)}
      data-testid="back-link"
    >
      <ChevronLeftIcon aria-hidden="true" className="size-6" />
    </Link>
  );
}

/** The close control for a page that starts something new: an X at the right, going to the parent like the back control. */
export function CloseLink({ href, label, className }: { href: string; /** The parent's name: "Jobs". */ label: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label={`Close and go back to ${label}`}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "-mr-3 size-11 shrink-0", className)}
      data-testid="close-link"
    >
      <XIcon aria-hidden="true" className="size-6" />
    </Link>
  );
}

export function PageHeader({
  back,
  close,
  children,
  className,
}: {
  /** A page that shows something that already exists: a chevron on the left. */
  back?: { href: string; /** The parent's name: "Quotes", read out as "Back to Quotes". */ label: string };
  /** A page that starts something new (a form to fill in): an X on the right, like a new quote. */
  close?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-1", className)}>
      {back && <BackLink href={back.href} label={back.label} />}
      {/* The heading's first line sits level with the middle of the 44px control. */}
      <div className="min-w-0 flex-1 space-y-1 pt-2">{children}</div>
      {close && <CloseLink href={close.href} label={close.label} />}
    </div>
  );
}
