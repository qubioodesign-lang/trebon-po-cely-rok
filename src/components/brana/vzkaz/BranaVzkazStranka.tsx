import { BranaDesktopInformacniPanel } from "../BranaDesktopInformacniPanel";
import { BranaDenniDobaObal } from "../BranaDenniDobaObal";
import { BranaVzkazFormular } from "./BranaVzkazFormular";

type BranaVzkazStrankaProps = {
  vychoziNocRezim: boolean;
};

export function BranaVzkazStranka({ vychoziNocRezim }: BranaVzkazStrankaProps) {
  return (
    <BranaDenniDobaObal
      vychoziNocRezim={vychoziNocRezim}
      desktopPanel={<BranaDesktopInformacniPanel />}
    >
      <BranaVzkazFormular />
    </BranaDenniDobaObal>
  );
}
