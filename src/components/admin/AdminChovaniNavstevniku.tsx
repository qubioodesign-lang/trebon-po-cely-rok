import type { ChovaniNavstevnikuSouhrn, ChovaniNavstevObdobiSouhrn } from "@/types";

interface PropsAdminChovaniNavstevniku {
  chovani: ChovaniNavstevnikuSouhrn | null;
}

function formatovatDelku(ms: number): string {
  const sekundy = ms / 1000;
  if (sekundy < 60) {
    return `${sekundy.toFixed(1).replace(".", ",")} s`;
  }

  const minuty = Math.floor(sekundy / 60);
  const zbytek = Math.round(sekundy % 60);
  return `${minuty} min ${zbytek} s`;
}

function formatovatProcento(pocet: number, celkem: number): string {
  if (celkem <= 0) {
    return "0 %";
  }

  return `${Math.round((pocet / celkem) * 100)} %`;
}

function BlokObdobi({
  nadpis,
  obdobi,
}: {
  nadpis: string;
  obdobi: ChovaniNavstevObdobiSouhrn;
}) {
  const { pocetNavstev } = obdobi;

  return (
    <div className="space-y-2 rounded-sm border border-text-velmiJemny/10 p-3">
      <h3 className="text-xs font-light text-text-jemny">{nadpis}</h3>
      <div className="space-y-1 text-xs text-text-velmiJemny">
        <p>
          Návštěv:{" "}
          <span className="tabular-nums text-text">{pocetNavstev}</span>
        </p>
        <p>
          Průměrný čas:{" "}
          <span className="tabular-nums text-text">
            {formatovatDelku(obdobi.prumerDelkaMs)}
          </span>
        </p>
      </div>
      <div className="space-y-1 text-xs text-text-velmiJemny">
        <p className="text-text-jemny">Odkud odešli:</p>
        <p>
          Příběh:{" "}
          <span className="tabular-nums text-text">
            {formatovatProcento(obdobi.odchodPribeh, pocetNavstev)}
          </span>
        </p>
        <p>
          Chci se vracet:{" "}
          <span className="tabular-nums text-text">
            {formatovatProcento(obdobi.odchodChciSeVracet, pocetNavstev)}
          </span>
        </p>
        <p>
          Ostatní:{" "}
          <span className="tabular-nums text-text">
            {formatovatProcento(obdobi.odchodOstatni, pocetNavstev)}
          </span>
        </p>
      </div>
    </div>
  );
}

export function AdminChovaniNavstevniku({ chovani }: PropsAdminChovaniNavstevniku) {
  if (!chovani) {
    return (
      <section className="space-y-3 border border-text-velmiJemny/20 p-4">
        <h2 className="text-sm font-light text-text-jemny">Chování návštěvníků</h2>
        <p className="text-xs text-text-velmiJemny">Data nejsou k dispozici</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 border border-text-velmiJemny/20 p-4">
      <h2 className="text-sm font-light text-text-jemny">Chování návštěvníků</h2>
      <p className="text-xs text-text-velmiJemny">
        Délka návštěvy a místo odchodu – jednoduchý kompas, zda lidé odcházejí během
        příběhu, nebo se dostanou k části „Chci se vracet“.
      </p>

      <BlokObdobi nadpis="Posledních 7 dní" obdobi={chovani.poslednich7Dni} />
      <BlokObdobi nadpis="Celkem" obdobi={chovani.celkem} />
    </section>
  );
}
