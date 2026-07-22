// Placeholder shared component — real component set grows here as both
// apps need shared UI (buttons, form fields, badges for lead stage/car status).
export function Button({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
    >
      {children}
    </button>
  );
}
