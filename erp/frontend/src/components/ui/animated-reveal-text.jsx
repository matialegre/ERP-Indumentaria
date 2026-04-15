import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

const HighlightText = React.forwardRef(
  (
    {
      text,
      as: Component = "h1",
      className,
      textClassName,
      highlightClassName,
      duration = 1.5,
      highlightColor = "#d7ff7b",
      ease = "easeInOut",
      ...props
    },
    ref
  ) => {
    return (
      <div ref={ref} className={cn("text-center", className)} {...props}>
        <Component
          className={cn(
            "text-5xl font-[700] leading-[1.5] tracking-normal max-w-3xl",
            textClassName
          )}
        >
          <motion.span
            className={cn(
              "relative py-[10px] px-[8px] rounded-[10px] mb-[5px] mx-2",
              "text-[#1A1A1A]",
              highlightClassName
            )}
            initial={{ clipPath: "inset(0 100% 0 0)", backgroundColor: highlightColor }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration, ease }}
          >
            {text}
          </motion.span>
        </Component>
      </div>
    );
  }
);
HighlightText.displayName = "HighlightText";

export { HighlightText };
