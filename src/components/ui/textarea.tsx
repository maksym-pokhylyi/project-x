import * as React from "react"
import { cn } from "@/lib/utils"
import { controlClasses } from "@/components/ui/input"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlClasses, "flex field-sizing-content min-h-24 py-2 leading-6 md:leading-5", className)}
      {...props}
    />
  )
}

export { Textarea }
