import { ReactNode } from "react";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const BentoGrid = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
};

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  children,
}: {
  name: string;
  className: string;
  background?: ReactNode;
  Icon?: any;
  description?: string;
  href?: string;
  cta?: string;
  children?: ReactNode;
}) => (
  <div
    key={name}
    className={cn(
      "group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-xl min-h-[22rem]",
      // Dark glassmorphism styles matching login page
      "bg-black/40 backdrop-blur-sm border border-white/10",
      "[box-shadow:0_0_0_1px_rgba(255,255,255,.05),0_2px_4px_rgba(0,0,0,.2),0_12px_24px_rgba(0,0,0,.3)]",
      "transform-gpu",
      className,
    )}
  >
    {background && <div>{background}</div>}
    {children ? (
      <div className="flex h-full flex-col p-6">{children}</div>
    ) : (
      <>
        <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 p-6 transition-all duration-300 group-hover:-translate-y-10">
          {Icon && (
            <Icon className="h-12 w-12 origin-left transform-gpu text-white transition-all duration-300 ease-in-out group-hover:scale-75" />
          )}
          <h3 className="text-xl font-semibold text-white">
            {name}
          </h3>
          {description && (
            <p className="max-w-lg text-gray-300/80">{description}</p>
          )}
        </div>

        {href && cta && (
          <div
            className={cn(
              "pointer-events-none absolute bottom-0 flex w-full translate-y-10 transform-gpu flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100",
            )}
          >
            <Button variant="ghost" asChild size="sm" className="pointer-events-auto">
              <a href={href}>
                {cta}
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        )}
      </>
    )}
    <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-white/5" />
  </div>
);

export { BentoCard, BentoGrid };

