"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface AnimatedTextProps {
    text?: string;
    className?: string;
    style?: React.CSSProperties;
}

function AnimatedText({
    text = "Hover me",
    className = "",
    style,
}: AnimatedTextProps) {
    return (
        <motion.span
            className={cn(
                "inline-block cursor-pointer transition-all whitespace-nowrap",
                className
            )}
            style={style}
            whileHover="hover"
            initial="initial"
        >
            {text.split("").map((char, index) => (
                <motion.span
                    key={index}
                    className={char === " " ? "inline-block w-2" : "inline-block"}
                    variants={{
                        initial: {
                            y: 0,
                            scale: 1,
                        },
                        hover: {
                            y: -4,
                            scale: 1.2,
                            transition: {
                                type: "spring",
                                stiffness: 300,
                                damping: 15,
                                delay: index * 0.03,
                            },
                        },
                    }}
                >
                    {char === " " ? "\u00A0" : char}
                </motion.span>
            ))}
        </motion.span>
    );
}

export { AnimatedText }

