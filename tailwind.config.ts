import type { Config } from "tailwindcss";

// 커스텀 컬러는 src/app/globals.css의 @theme 블록에서 관리 (Tailwind v4 방식)
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};

export default config;
