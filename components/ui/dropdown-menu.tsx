"use client";
import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "z-50 min-w-44 overflow-hidden rounded-md border border-line bg-overlay p-1 text-ink shadow-menu data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          "z-50 min-w-40 overflow-hidden rounded-md border border-line bg-overlay p-1 text-ink shadow-menu data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

const itemClass =
  "relative flex h-9 cursor-pointer items-center gap-2 rounded-xs px-2.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-raised [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-2 sm:h-8";

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        itemClass,
        destructive && "text-bad data-[highlighted]:bg-bad-soft [&_svg]:text-bad",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(itemClass, "data-[state=open]:bg-raised", className)}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" aria-hidden />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem className={cn(itemClass, "pl-8", className)} {...props}>
      <span className="absolute left-2.5 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-3.5 text-accent" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem className={cn(itemClass, "pl-8", className)} {...props}>
      <span className="absolute left-2.5 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-3.5 text-accent" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("px-2.5 py-1.5 text-xs text-ink-3", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-line", className)}
      {...props}
    />
  );
}

export function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("ml-auto text-xs text-ink-3", className)} {...props} />;
}
