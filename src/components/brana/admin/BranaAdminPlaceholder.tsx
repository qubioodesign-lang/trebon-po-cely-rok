type BranaAdminPlaceholderProps = {
  nadpis: string;
  popis: string;
};

/**
 * Prázdný placeholder sekce administrace.
 * Bez formulářů, dat a business logiky – jen místo pro budoucí obsah.
 */
export function BranaAdminPlaceholder({
  nadpis,
  popis,
}: BranaAdminPlaceholderProps) {
  return (
    <section className="space-y-2" aria-labelledby="brana-admin-sekce-nadpis">
      <h2
        id="brana-admin-sekce-nadpis"
        className="brana-nadpis-sekce text-text"
      >
        {nadpis}
      </h2>
      <p className="brana-text-jemny">{popis}</p>
    </section>
  );
}
