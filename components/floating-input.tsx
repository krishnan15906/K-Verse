import type React from "react"
import { cn } from "@/lib/utils"

type FloatingInputProps = {
  label: string
} & React.InputHTMLAttributes<HTMLInputElement>

export function FloatingInput({ label, name, value, className, ...props }: FloatingInputProps) {
  const hasValue = typeof value === "string" && value.length > 0
  return (
    <div className="relative">
      <input
        id={name}
        name={name}
        value={value}
        placeholder=" "
        className={cn(
          "peer h-12 w-full rounded-lg border border-input bg-secondary/60 px-3 pt-4 text-sm text-foreground outline-none transition-all placeholder-transparent focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30",
          className,
        )}
        {...props}
      />
      <label
        htmlFor={name}
        className={cn(
          "pointer-events-none absolute left-3 text-muted-foreground transition-all",
          hasValue ? "top-1.5 text-[10px]" : "top-1/2 -translate-y-1/2 text-xs",
          "peer-focus:top-1.5 peer-focus:-translate-y-0 peer-focus:text-[10px]",
        )}
      >
        {label}
      </label>
    </div>
  )
}
