import Link from "@/components/app-link";
import type { ComponentProps } from "react";
import { PlusIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

/**
 * The one way to show an action that adds something (docs/adr/0008-add-actions.md): a plus before a short label that
 * says what is added ("Add item", "Add another choice"). The plus makes every add action recognisable at a glance;
 * the words stay, because several can be on one screen and a bare plus does not say which. The plus is decoration
 * (the button's name is its label), and the button is as big as any other (44 px).
 */
export function AddButton({ children, variant = "outline", ...props }: ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant={variant} {...props}>
      <PlusIcon aria-hidden="true" data-icon="inline-start" />
      {children}
    </Button>
  );
}

/** An add action that goes to another page: the same look as {@link AddButton}, for a link. */
export function AddLink({ children, variant = "outline", className, ...props }: ComponentProps<typeof Link> & { variant?: "default" | "outline" }) {
  return (
    <Link className={cn(buttonVariants({ variant }), "has-data-[icon=inline-start]:pl-3", className)} {...props}>
      <PlusIcon aria-hidden="true" data-icon="inline-start" />
      {children}
    </Link>
  );
}
