/** Pracovní data událostí pro pohled Výhled – formát „11. 11.“ bez dne, roku a času. */
export const BRANA_VYHLED_DATUMY = [
  "15. 3.",
  "22. 4.",
  "11. 5.",
  "20. 6.",
  "15. 7.",
  "11. 8.",
  "22. 9.",
  "15. 10.",
  "11. 11.",
  "15. 1.",
  "14. 2.",
  "11. 3.",
  "20. 4.",
  "15. 5.",
  "11. 6.",
  "22. 7.",
  "15. 8.",
  "11. 9.",
] as const;

export const BRANA_VYHLED_PREDEL_INDEX = Math.ceil(BRANA_VYHLED_DATUMY.length / 2);
