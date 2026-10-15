import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn("mx-auto w-full max-w-[1240px] flex-1 px-4 pt-10 sm:px-6 sm:pt-14", className)}>{children}</main>;
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-10 border-b border-rule pb-8">
      {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
      <h1 className="font-serif text-[30px] leading-[1.15] font-semibold tracking-tight text-ink sm:text-[38px]">
        {title}
      </h1>
      {lede && <div className="mt-4 max-w-3xl text-[15.5px] leading-relaxed text-ink-2">{lede}</div>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

export function Section({
  title,
  kicker,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: string;
  kicker?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("mt-14 scroll-mt-20", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          {kicker && <div className="eyebrow mb-1.5">{kicker}</div>}
          <h2 className="font-serif text-[21px] leading-snug font-semibold tracking-tight text-ink">{title}</h2>
          {description && <div className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Figure({
  title,
  caption,
  children,
  className,
  actions,
}: {
  title?: string;
  caption?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <figure className={cn("min-w-0 rounded-md border border-rule bg-paper p-4 sm:p-5", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          {title && <div className="text-[13px] font-medium text-ink">{title}</div>}
          {actions}
        </div>
      )}
      {children}
      {caption && <figcaption className="mt-3 text-[12px] leading-relaxed text-ink-3">{caption}</figcaption>}
    </figure>
  );
}
