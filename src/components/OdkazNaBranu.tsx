/** Odkaz z mobilní galerie na veřejnou BRÁNU. */
export function OdkazNaBranu() {
  return (
    <a
      href="https://brana.trebonpocelyrok.cz/"
      className="fixed z-[25] whitespace-nowrap font-sans text-[15px] font-medium leading-snug tracking-tight text-white no-underline md:hidden"
      style={{
        left: "50%",
        bottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
        transform: "translateX(-50%)",
      }}
    >
      <span className="inline-block text-[calc(0.9375rem*1.09)] font-semibold after:mt-0.5 after:block after:h-px after:w-full after:bg-[#cf9168] after:content-['']">
        BRÁNA
      </span>
      <span className="text-[calc(0.9375rem*0.875)] font-normal"> do Třeboně</span>{" "}
      <span className="text-[15px] font-medium opacity-70" aria-hidden="true">
        →
      </span>
    </a>
  );
}
