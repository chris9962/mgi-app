import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import "@/fonts/google-sans.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND_NAME, template: `%s - ${BRAND_NAME}` },
  icons: { icon: "/brand/logo.png" },
};

// Đặt theme trước khi vẽ để trang không chớp màu sáng rồi mới sang tối.
const themeScript = `try{var d=document.documentElement.dataset,t=localStorage.getItem("theme"),a=localStorage.getItem("accent");if(t==="dark")d.theme="dark";if(a)d.accent=a}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
