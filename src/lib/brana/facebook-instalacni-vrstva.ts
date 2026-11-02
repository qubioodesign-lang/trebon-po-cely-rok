/** Stav vysvětlující facebookové vrstvy BRÁNY. Bez route a bez instalačního promptu. */

type StavFacebookVrstvy = {
  otevreno: boolean;
};

const stav: StavFacebookVrstvy = {
  otevreno: false,
};

const posluchaci = new Set<() => void>();

function oznamit(): void {
  posluchaci.forEach((posluchac) => {
    posluchac();
  });
}

export function jeFacebookNaAndroidu(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const prohlizec = navigator.userAgent;
  return /Android/i.test(prohlizec) && /FB_IAB|FBAN|FBAV/.test(prohlizec);
}

export function ziskatFacebookInstalacniVrstvu(): StavFacebookVrstvy {
  return { otevreno: stav.otevreno };
}

export function otevritFacebookInstalacniVrstvu(): void {
  if (stav.otevreno) {
    return;
  }

  stav.otevreno = true;
  oznamit();
}

export function zavritFacebookInstalacniVrstvu(): void {
  if (!stav.otevreno) {
    return;
  }

  stav.otevreno = false;
  oznamit();
}

export function priZmeneFacebookInstalacniVrstvy(
  posluchac: () => void,
): () => void {
  posluchaci.add(posluchac);

  return () => {
    posluchaci.delete(posluchac);
  };
}
