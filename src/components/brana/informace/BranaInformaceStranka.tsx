import { BranaDenniDobaObal } from "../BranaDenniDobaObal";
import { BranaInformace } from "./BranaInformace";

type BranaInformaceStrankaProps = {
  vychoziNocRezim: boolean;
};

export function BranaInformaceStranka({
  vychoziNocRezim,
}: BranaInformaceStrankaProps) {
  return (
    <BranaDenniDobaObal vychoziNocRezim={vychoziNocRezim}>
      <BranaInformace />
    </BranaDenniDobaObal>
  );
}
