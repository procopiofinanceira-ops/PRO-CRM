/** Foto do usuário, ou a inicial do nome quando ele não colocou foto. */
export default function Avatar({ usuario, className = 'h-10 w-10 text-xs', children }) {
  const inicial = (usuario?.nome ?? '?').trim().charAt(0).toUpperCase();
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary/30 to-accent2/30 font-semibold ${className}`}
    >
      {usuario?.fotoUrl ? (
        <img src={usuario.fotoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        inicial
      )}
      {children}
    </span>
  );
}
