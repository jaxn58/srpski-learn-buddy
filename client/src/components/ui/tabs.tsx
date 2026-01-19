import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        [
          // Base
          "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1",
          "text-sm font-medium whitespace-nowrap transition-[color,box-shadow,background-color]",
          "disabled:pointer-events-none disabled:opacity-50",
          // Default state
          "text-foreground dark:text-muted-foreground",
          // Focus (avoid default bluish ring; align with gold active language)
          "focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-[color:var(--accent)]/25 focus-visible:border-[color:var(--accent)]/40",
          // Active (gold + off-white)
          "data-[state=active]:bg-[color:var(--accent)] data-[state=active]:text-white data-[state=active]:shadow-sm",
          "data-[state=active]:border-[color:var(--accent)]/60",
          // Icons follow text color automatically (currentColor)
          "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        ].join(" "),
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
