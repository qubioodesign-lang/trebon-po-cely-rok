import { ObrazovkaChciSeVracet } from "@/components/ObrazovkaChciSeVracet";

/** Obrazovka „chci se vracet“ – klidná, centrovaná, teplé pozadí */
export default async function StrankaChciSeVracet({
  searchParams,
}: {
  searchParams: Promise<{ dokoncit?: string }>;
}) {
  const { dokoncit } = await searchParams;

  return <ObrazovkaChciSeVracet dokoncitInstalaci={dokoncit === "1"} />;
}
