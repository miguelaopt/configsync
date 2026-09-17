"use client";
import * as React from "react";
import { Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { GameDialog } from "./game-dialog";
import type { PublicCatalogEntry } from "@/lib/catalog";

export function NewGameButton({
  autoOpen = false,
  variant = "primary",
  size,
  catalog,
  owned,
}: {
  autoOpen?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  catalog?: PublicCatalogEntry[];
  owned?: string[];
}) {
  const [open, setOpen] = React.useState(autoOpen);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus /> Add game
      </Button>
      <GameDialog open={open} onOpenChange={setOpen} catalog={catalog} owned={owned} />
    </>
  );
}
