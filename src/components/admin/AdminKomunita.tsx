import type { KomunitaObdobiSouhrn, KomunitaSouhrn } from "@/types";

function KartaHodnoty({
  popisek,
  hodnota,
}: {
  popisek: string;
  hodnota: string | number;
}) {
  return (
    <div className="rounded border border-text-velmiJemny/20 bg-krem-tmavsi/20 px-4 py-3">
      <p className="text-[11px] font-light uppercase tracking-wide text-text-velmiJemny">
        {popisek}
      </p>
      <p className="mt-1 text-2xl font-light tabular-nums text-text">{hodnota}</p>
    </div>
  );
}

function BlokObdobi({
  nadpis,
  data,
}: {
  nadpis: string;
  data: KomunitaObdobiSouhrn;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-light text-text-velmiJemny">{nadpis}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KartaHodnoty popisek="noví návštěvníci" hodnota={data.noviNavstevnici} />
        <KartaHodnoty
          popisek="vracející se návštěvníci"
          hodnota={data.vracejiciSeNavstevnici}
        />
        <KartaHodnoty
          popisek="podíl vracejících se"
          hodnota={`${data.podilVracejicichSe.toFixed(1)} %`}
        />
      </div>
    </div>
  );
}

interface PropsAdminKomunita {
  komunita: KomunitaSouhrn | null;
}

export function AdminKomunita({ komunita }: PropsAdminKomunita) {
  if (!komunita) {
    return (
      <section className="space-y-3 rounded border border-text-velmiJemny/20 p-4">
        <h2 className="text-sm font-light text-text-jemny">komunita</h2>
        <p className="text-xs text-text-velmiJemny">data komunity nejsou k dispozici</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded border border-text-velmiJemny/20 p-4">
      <h2 className="text-sm font-light text-text-jemny">komunita</h2>
      <BlokObdobi nadpis="celkem od začátku" data={komunita.celkem} />
      <BlokObdobi nadpis="posledních 7 dní" data={komunita.poslednich7Dni} />
    </section>
  );
}
