import * as React from "react"
import { cn } from "@/lib/utils"

interface HoverGlassContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const HoverGlassContainer = React.forwardRef<HTMLDivElement, HoverGlassContainerProps>(
  ({ className, children, ...props }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null)
    
    // Set forwarded ref
    React.useEffect(() => {
      if (typeof ref === 'function') {
        ref(containerRef.current)
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = containerRef.current
      }
    })

    return (
      <div
        ref={containerRef}
        className={cn(
          "relative isolate rounded-3xl",
          "backdrop-blur-lg bg-[rgba(43,55,80,0.1)]",
          "cursor-pointer overflow-hidden",
          "before:content-[''] before:absolute before:inset-0",
          "before:rounded-[inherit] before:pointer-events-none",
          "before:z-[1]",
          "before:shadow-[inset_0_0_0_1px_rgba(170,202,255,0.2),inset_0_0_16px_0_rgba(170,202,255,0.1),inset_0_-3px_12px_0_rgba(170,202,255,0.15),0_1px_3px_0_rgba(0,0,0,0.50),0_4px_12px_0_rgba(0,0,0,0.45)]",
          "before:mix-blend-multiply before:transition-transform before:duration-300",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

HoverGlassContainer.displayName = "HoverGlassContainer"

export { HoverGlassContainer }

