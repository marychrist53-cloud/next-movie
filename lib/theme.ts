export const THEME_KEY = "nm-theme";

export const themeScript = `try{if(localStorage.getItem("${THEME_KEY}")==="light"){document.documentElement.classList.remove("dark")}}catch(e){}`;
