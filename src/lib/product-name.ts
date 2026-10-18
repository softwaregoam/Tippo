export const productDisplayName = (name: string) => name.replace(/(?:\s*\(salinan\))+\s*$/i, "").trim() || name;
