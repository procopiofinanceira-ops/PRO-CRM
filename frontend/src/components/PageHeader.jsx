export default function PageHeader({ titulo, descricao, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-muted">{descricao}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
