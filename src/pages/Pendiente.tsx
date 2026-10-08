import { Vacio } from "../components/ui";

export default function Pendiente({ titulo, fase }: { titulo: string; fase: string }) {
  return (
    <>
      <h1 className="mb-4 text-xl font-extrabold">{titulo}</h1>
      <Vacio titulo="Esta sección todavía no está construida" detalle={`Se desarrolla en la ${fase} del plan. Tus datos no se ven afectados.`} />
    </>
  );
}
