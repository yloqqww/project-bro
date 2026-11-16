'use client';

import * as React from "react";

const TabsContext = React.createContext<{ value: string; onChange: (value: string) => void }>({
  value: "",
  onChange: () => {}
});

const Tabs = ({ value, onValueChange, children, className = "" }: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <TabsContext.Provider value={{ value, onChange: onValueChange }}>
    <div className={className}>{children}</div>
  </TabsContext.Provider>
);

const TabsList = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 ${className}`}
    {...props}
  />
);

const TabsTrigger = ({ value, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) => {
  const context = React.useContext(TabsContext);
  const isActive = context.value === value;

  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
      } ${className}`}
      onClick={() => context.onChange(value)}
      {...props}
    />
  );
};

const TabsContent = ({ value, className = "", ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) => {
  const context = React.useContext(TabsContext);
  if (context.value !== value) return null;

  return <div className={`mt-2 ${className}`} {...props} />;
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
