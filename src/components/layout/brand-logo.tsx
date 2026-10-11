import Image from "next/image";
import { brand } from "@/config/navigation";

/** The DevSyndicate mark (public/logo.png, made from DevSyndicateLogoRounded.png). Decorative: the name sits next to it. */
export function BrandLogo() {
  return <Image src={brand.logo} alt="" width={32} height={32} priority className="size-8 shrink-0 rounded-lg" />;
}
