/** Stav celoobrazovkové iOS instalační vrstvy (bez route). */

export type BranaIosInstalacniVarianta = "SAFARI" | "JINY_PROHLIZEC";

type StavIosInstalacniVrstvy = {
  otevreno: boolean;
  varianta: BranaIosInstalacniVarianta | null;
};

const stav: StavIosInstalacniVrstvy = {
  otevreno: false,
  varianta: null,
};

const posluchaci = new Set<() => void>();

function oznamit(): void {
  posluchaci.forEach((posluchac) => {
    posluchac();
  });
}

export function ziskatIosInstalacniVrstvu(): StavIosInstalacniVrstvy {
  return {
    otevreno: stav.otevreno,
    varianta: stav.varianta,
  };
}

export function otevritIosInstalacniVrstvu(
  varianta: BranaIosInstalacniVarianta,
): void {
  stav.otevreno = true;
  stav.varianta = varianta;
  oznamit();
}

export function zavritIosInstalacniVrstvu(): void {
  if (!stav.otevreno) {
    return;
  }

  stav.otevreno = false;
  stav.varianta = null;
  oznamit();
}

export function priZmeneIosInstalacniVrstvy(posluchac: () => void): () => void {
  posluchaci.add(posluchac);

  return () => {
    posluchaci.delete(posluchac);
  };
}
