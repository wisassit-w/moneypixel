export type Theme = "cozy" | "pastel" | "dark";

export const THEMES: readonly Theme[] = ["cozy", "pastel", "dark"];
export const DEFAULT_THEME: Theme = "cozy";
export const THEME_STORAGE_KEY = "moneypixel-theme";

// colour of the phone's browser bar
export const THEME_COLOR: Record<Theme, string> = {
    cozy: "#4e6e58",
    pastel: "#477f71",
    dark: "#171a17",
};

export const isTheme = (v: unknown): v is Theme => v === "cozy" || v === "pastel" || v === "dark";

/**
 * Runs in <head> BEFORE the page is painted, so the saved theme is applied with no flash.
 * It only sets an attribute on <html>; React never has to re-render the page for it.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="pastel"&&t!=="dark")t="${DEFAULT_THEME}";var d=document.documentElement;d.setAttribute("data-theme",t);d.style.colorScheme=t==="dark"?"dark":"light"}catch(e){}})();`;