'use client';

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";

interface SelectContextType {
  open: boolean;
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  value?: string;
  onValueChange?: (value: string, label?: React.ReactNode) => void;
  selectedLabel: React.ReactNode;
}

const SelectContext = React.createContext<SelectContextType | null>(null);

function useSelect(): SelectContextType {
  const ctx = React.useContext(SelectContext);
  if (!ctx) {
    return {
      open: false,
      setOpen: () => {},
      value: undefined,
      onValueChange: () => {},
      selectedLabel: null,
    };
  }
  return ctx;
}

// Pure helper function to find the label of an item matching the selected value
function findItemLabel(nodes: React.ReactNode, targetValue?: string): React.ReactNode | null {
  if (targetValue === undefined || targetValue === null || targetValue === "") return null;
  let match: React.ReactNode = null;

  React.Children.forEach(nodes, (node) => {
    if (match) return;
    if (React.isValidElement(node)) {
      const p = node.props as { value?: string; children?: React.ReactNode };
      if (p && p.value === targetValue && p.children !== undefined) {
        match = p.children;
      } else if (p && p.children) {
        match = findItemLabel(p.children, targetValue);
      }
    }
  });

  return match;
}

// Main Select Component
const Select = ({
  value,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(defaultValue || "");
  const [clickedLabel, setClickedLabel] = React.useState<React.ReactNode>(null);

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = React.useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const nextVal = typeof next === "function" ? next(open) : next;
      if (onOpenChange) {
        onOpenChange(nextVal);
      } else {
        setUncontrolledOpen(nextVal);
      }
    },
    [open, onOpenChange]
  );

  const handleValueChange = React.useCallback(
    (val: string, label?: React.ReactNode) => {
      if (!isControlled) {
        setInternalValue(val);
      }
      setClickedLabel(label || val);
      onValueChange?.(val);
      setOpen(false);
    },
    [isControlled, onValueChange, setOpen]
  );

  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, setOpen]);

  // Compute label purely during render without useEffect loops
  const derivedLabel = clickedLabel || findItemLabel(children, currentValue);

  return (
    <SelectContext.Provider
      value={{
        open,
        setOpen,
        value: currentValue,
        onValueChange: handleValueChange,
        selectedLabel: derivedLabel,
      }}
    >
      <div ref={containerRef} className="relative inline-block w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

// Select Trigger
const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className = "", children, ...props }, ref) => {
  const { open, setOpen } = useSelect();

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      aria-expanded={open}
      className={`flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className}`}
      {...props}
    >
      {children}
      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180 text-slate-600' : ''}`} />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

// Select Value
const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const { selectedLabel, value } = useSelect();
  return (
    <span className="block truncate text-left">
      {selectedLabel || value || placeholder || "Select..."}
    </span>
  );
};

// Select Content
const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", children, ...props }, ref) => {
  const { open } = useSelect();

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={`absolute z-50 mt-1 min-w-[8rem] w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto py-1 text-sm text-slate-800 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
SelectContent.displayName = "SelectContent";

// Select Item
const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ value, children, className = "", ...props }, ref) => {
  const { value: selectedValue, onValueChange } = useSelect();
  const isSelected = selectedValue === value;

  return (
    <div
      ref={ref}
      onClick={() => onValueChange?.(value, children)}
      className={`relative flex cursor-pointer select-none items-center justify-between px-3 py-2 text-sm outline-none hover:bg-slate-100 transition-colors ${
        isSelected ? "font-semibold bg-slate-50 text-slate-900" : "text-slate-700"
      } ${className}`}
      {...props}
    >
      <span className="truncate">{children}</span>
      {isSelected && <Check className="w-4 h-4 text-slate-900 ml-2 flex-shrink-0" />}
    </div>
  );
});
SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
