'use client';

import * as React from "react";
import { X } from "lucide-react";

const Dialog = ({ open, onOpenChange, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={() => onOpenChange(false)} />
      <div className="relative z-50 w-full max-w-7xl flex items-center justify-center">{children}</div>
    </div>
  );
};

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = "", children, ...props }, ref) => {
    const hasCustomMaxWidth = className.includes("max-w-");
    const widthClass = hasCustomMaxWidth ? "" : "max-w-lg";

    return (
      <div
        ref={ref}
        className={`bg-white rounded-xl shadow-2xl w-full max-h-[92vh] overflow-y-auto ${widthClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props} />
);

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = "", ...props }, ref) => (
    <h2 ref={ref} className={`text-xl font-bold leading-none tracking-tight ${className}`} {...props} />
  )
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = ({ className = "", ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-sm text-gray-600 ${className}`} {...props} />
);

const DialogTrigger = ({ asChild, children, ...props }: {
  asChild?: boolean;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) => {
  return <>{children}</>;
};

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription };
