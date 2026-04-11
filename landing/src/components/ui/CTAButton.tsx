import { APP_CHECKOUT_URL } from "@/config/site";

interface CTAButtonProps {
  href?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

const variantClasses = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:shadow-xl",
  secondary:
    "bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-sm",
  outline:
    "bg-transparent text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400",
  ghost:
    "bg-transparent text-indigo-600 hover:bg-indigo-50",
};

const sizeClasses = {
  sm: "px-5 py-2.5 text-sm rounded-lg",
  md: "px-7 py-3.5 text-base rounded-xl",
  lg: "px-9 py-4 text-lg rounded-xl",
};

export function CTAButton({
  href = APP_CHECKOUT_URL,
  variant = "primary",
  size = "md",
  children,
  className = "",
  fullWidth = false,
}: CTAButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 cursor-pointer",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </a>
  );
}
