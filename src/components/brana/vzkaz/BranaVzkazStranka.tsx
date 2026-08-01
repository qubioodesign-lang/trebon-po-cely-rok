import { BranaVzkazFormular } from "./BranaVzkazFormular";
import { BranaVzkazObal } from "./BranaVzkazObal";

type BranaVzkazStrankaProps = {
  vychoziNocRezim: boolean;
};

export function BranaVzkazStranka({ vychoziNocRezim }: BranaVzkazStrankaProps) {
  return (
    <BranaVzkazObal vychoziNocRezim={vychoziNocRezim}>
      <BranaVzkazFormular />
    </BranaVzkazObal>
  );
}
