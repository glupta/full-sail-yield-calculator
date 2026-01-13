import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
    title: "Full Sail Yield Calculator",
    description: "Yield projection tool for Full Sail Finance LPs and SAIL token buyers",
    keywords: ["Full Sail", "DeFi", "Yield Calculator", "Sui", "Liquidity Provider"],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="animated-bg">
                {children}
            </body>
        </html>
    );
}
