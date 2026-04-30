import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

/** Consistent page padding with max-width centering, optimised for mobile. */
export function Page({ children, className = "" }: Props) {
  return <div className={`px-4 max-w-screen-md mx-auto w-full ${className}`}>{children}</div>;
}
